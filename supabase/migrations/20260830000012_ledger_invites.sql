-- BGI-22: 초대 코드/링크 (다회용) + 수락자 기록 + 수락 rate limit
--
-- 이메일 초대는 애플 Private Relay(프로덕션 애플 계정의 92%) 때문에 상대 이메일을 알 수 없어
-- 초대 대상의 62%가 초대 불가였다. 이메일 대신 다회용 초대 코드를 카톡 등으로 전달하고,
-- 받은 사람이 앱에서 코드를 입력(또는 bugie:// 딥링크)해 수락하면 멤버가 된다.
-- 피초대자는 아직 멤버가 아니라 일반 RLS로는 코드 조회·수락이 막히므로 SECURITY DEFINER RPC로 처리한다.
-- 설계: docs/features/ledger-invite/design.md

create extension if not exists pgcrypto with schema extensions;

-- ============================================================================
-- 테이블
-- ============================================================================

-- 다회용 초대 링크
create table public.ledger_invites (
  id          uuid primary key default gen_random_uuid(),
  ledger_id   uuid not null references public.ledgers(id)  on delete cascade,
  inviter_id  uuid references public.profiles(id) on delete set null,  -- 발급자 탈퇴해도 이력 보존
  code        text not null unique,                  -- 정규화 저장(대문자·영숫자), 표기는 ABCD-EFGH-IJKL
  role        member_role not null default 'member',
  status      text not null default 'active',        -- active | revoked (만료는 expires_at)
  max_uses    integer,                               -- null = 무제한
  use_count   integer not null default 0,
  expires_at  timestamptz not null default now() + interval '7 days',
  created_at  timestamptz not null default now()
);
create index idx_ledger_invites_code   on public.ledger_invites(code) where status = 'active';
create index idx_ledger_invites_ledger on public.ledger_invites(ledger_id);

-- 누가 이 링크로 들어왔나
create table public.ledger_invite_acceptances (
  id          uuid primary key default gen_random_uuid(),
  invite_id   uuid not null references public.ledger_invites(id) on delete cascade,
  user_id     uuid not null references public.profiles(id)       on delete cascade,
  accepted_at timestamptz not null default now(),
  unique (invite_id, user_id)
);
create index idx_invite_acceptances_invite on public.ledger_invite_acceptances(invite_id);

-- 수락 실패 rate limit
create table public.invite_accept_attempts (
  user_id      uuid not null references public.profiles(id) on delete cascade,
  attempted_at timestamptz not null default now()
);
create index idx_invite_attempts_user_time on public.invite_accept_attempts(user_id, attempted_at);

-- ============================================================================
-- GRANT (2026-10-30 이후 자동부여 종료 — 명시 필수)
-- 조회는 RLS(authenticated select), 쓰기는 DEFINER RPC 전담(직접 insert/update/delete GRANT 없음)
-- ============================================================================
grant select on public.ledger_invites to authenticated;
grant select, insert, update, delete on public.ledger_invites to service_role;

grant select on public.ledger_invite_acceptances to authenticated;
grant select, insert, update, delete on public.ledger_invite_acceptances to service_role;

-- invite_accept_attempts: authenticated 직접 접근 불필요(RPC/배치만)
grant select, insert, delete on public.invite_accept_attempts to service_role;

-- ============================================================================
-- RLS
-- ============================================================================
alter table public.ledger_invites            enable row level security;
alter table public.ledger_invite_acceptances enable row level security;
alter table public.invite_accept_attempts    enable row level security;
-- invite_accept_attempts 는 정책을 만들지 않는다 → authenticated 전면 차단(service_role/RPC만 접근).

-- 멤버십 재귀 회피용 admin 판별 헬퍼 (BGI-37 is_ledger_member 패턴).
-- DEFINER 로 RLS 우회 → ledger_members 를 다시 읽어도 정책 재적용 없이 재귀가 끊긴다.
-- null-safe: anon(auth.uid()=NULL)이면 false.
create or replace function public.is_ledger_admin(p_ledger_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from ledger_members lm
    where lm.ledger_id = p_ledger_id
      and lm.user_id = auth.uid()
      and lm.role in ('owner', 'admin')
      and lm.deleted_at is null
  );
$$;
revoke all on function public.is_ledger_admin(uuid) from public;
grant execute on function public.is_ledger_admin(uuid) to authenticated;
grant execute on function public.is_ledger_admin(uuid) to service_role;

-- 초대 링크: 해당 가계부의 owner/admin 만 조회
create policy ledger_invites_select on public.ledger_invites
  for select to authenticated
  using ( public.is_ledger_admin(ledger_id) );

-- 수락자: 그 초대가 속한 가계부의 owner/admin 만 조회
create policy ledger_invite_acceptances_select on public.ledger_invite_acceptances
  for select to authenticated
  using ( public.is_ledger_admin(
    (select li.ledger_id from public.ledger_invites li where li.id = invite_id)
  ) );

-- ============================================================================
-- RPC
-- 공통: DEFINER, search_path=public, auth.uid() is null 선차단, anon/PUBLIC EXECUTE 회수
-- ============================================================================

-- 초대 링크 생성 (owner 전용). 코드 반환.
create or replace function public.create_ledger_invite(
  p_ledger_id uuid,
  p_role member_role default 'member',
  p_max_uses integer default null
)
returns text
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_chars text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';  -- 0/O/1/I/L 제외 31자 → 12자 ≈ 59.4bit
  v_code text;
  v_bytes bytea;
  v_i int;
  v_active int;
begin
  if auth.uid() is null then
    raise exception '인증이 필요합니다.';
  end if;

  -- owner 만 초대 링크 생성 (앱 PermissionService.inviteMember: ['owner'] 와 정렬)
  if not exists (
    select 1 from ledger_members
    where ledger_id = p_ledger_id and user_id = auth.uid()
      and role = 'owner' and deleted_at is null
  ) then
    raise exception '초대 링크를 만들 권한이 없습니다.';
  end if;

  -- 권한 상승 방지: owner 역할로는 초대 불가
  if p_role = 'owner' then
    raise exception 'owner 역할로는 초대할 수 없습니다.';
  end if;

  -- 활성 초대 상한 (남용 방지)
  select count(*) into v_active
  from ledger_invites
  where ledger_id = p_ledger_id and status = 'active' and expires_at > now();
  if v_active >= 10 then
    raise exception '활성 초대 링크가 너무 많습니다. 기존 링크를 폐기하고 다시 시도해주세요.';
  end if;

  -- unique 코드 생성 (충돌 시 재시도)
  loop
    v_bytes := extensions.gen_random_bytes(12);
    v_code := '';
    for v_i in 0..11 loop
      v_code := v_code || substr(v_chars, (get_byte(v_bytes, v_i) % length(v_chars)) + 1, 1);
    end loop;
    exit when not exists (select 1 from ledger_invites where code = v_code);
  end loop;

  insert into ledger_invites (ledger_id, inviter_id, code, role, max_uses)
  values (p_ledger_id, auth.uid(), v_code, p_role, p_max_uses);

  return v_code;
end;
$function$;

revoke execute on function public.create_ledger_invite(uuid, member_role, integer) from anon, public;
grant execute on function public.create_ledger_invite(uuid, member_role, integer) to authenticated;
grant execute on function public.create_ledger_invite(uuid, member_role, integer) to service_role;

-- 초대 수락. 참여한 ledger_id 반환.
create or replace function public.accept_ledger_invite(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_code text;
  v_invite ledger_invites;
  v_fail int;
begin
  if auth.uid() is null then
    raise exception '인증이 필요합니다.';
  end if;

  -- 표기 포맷(하이픈/공백/소문자) 흡수
  v_code := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));

  -- 브루트포스 rate limit (최근 10분 내 시도 10회 이상 차단)
  --
  -- 주의: RAISE EXCEPTION 은 같은 트랜잭션의 INSERT 를 함께 롤백시킨다. 따라서 "실패했을 때
  -- 기록"하는 순서로는 카운트가 절대 쌓이지 않는다(검증에서 0건 확인). 그래서 순서를 뒤집어
  -- **시도 시점에 먼저 기록**하고, 수락에 성공하면 그 사용자의 기록을 지운다.
  -- 결과적으로 남아 있는 행 = 미해결 실패 시도 → 이 카운트로 브루트포스를 차단한다.
  select count(*) into v_fail
  from invite_accept_attempts
  where user_id = auth.uid() and attempted_at > now() - interval '10 minutes';
  if v_fail >= 10 then
    raise exception '너무 많은 시도가 있었습니다. 잠시 후 다시 시도해주세요.';
  end if;

  insert into invite_accept_attempts (user_id) values (auth.uid());

  -- 코드 조회 + 행 잠금(동시 수락 경합 방지)
  select * into v_invite
  from ledger_invites
  where code = v_code and status = 'active' and expires_at > now()
  for update;

  if not found then
    -- RAISE 가 아니라 NULL 반환이다. 예외를 던지면 이 요청의 트랜잭션 전체가 abort 되어
    -- 위의 attempt INSERT 까지 롤백된다(= rate limit 이 영원히 0건). 정상 커밋시켜 카운트를
    -- 남기려면 실패 분기가 예외 없이 끝나야 한다.
    -- 앱(LedgerRepository)에서 null 을 '유효하지 않거나 만료된 초대입니다'로 매핑한다
    -- (존재/만료/폐기를 구분하지 않는 단일 메시지 원칙은 그대로).
    return null;
  end if;

  -- 이미 이 가계부의 활성 멤버면 정원·기록을 소모하지 않고 이동만 시킨다.
  -- (owner 가 자기 링크를 실수로 눌러도 좌석이 줄지 않도록. 아래 upsert 는 복원 전용이 된다.)
  if exists (
    select 1 from ledger_members
    where ledger_id = v_invite.ledger_id and user_id = auth.uid() and deleted_at is null
  ) then
    delete from invite_accept_attempts where user_id = auth.uid();
    return v_invite.ledger_id;
  end if;

  -- 사용 정원
  if v_invite.max_uses is not null and v_invite.use_count >= v_invite.max_uses then
    raise exception '초대 정원이 찼습니다.';
  end if;

  -- 발급자가 여전히 이 가계부의 owner 인지 재검증 (나간/강등된 사람의 초대 무력화)
  if not exists (
    select 1 from ledger_members
    where ledger_id = v_invite.ledger_id and user_id = v_invite.inviter_id
      and role = 'owner' and deleted_at is null
  ) then
    raise exception '이 초대는 더 이상 유효하지 않습니다.';
  end if;

  -- 멤버 등록: 이미 active 멤버면 role 유지(강등 방지), soft-delete 되었으면 복원
  insert into ledger_members (ledger_id, user_id, role)
  values (v_invite.ledger_id, auth.uid(), v_invite.role)
  on conflict (ledger_id, user_id) do update
    set role = excluded.role, deleted_at = null
    where ledger_members.deleted_at is not null;

  -- 수락 기록 (같은 링크 중복 수락은 무시). 신규 기록일 때만 use_count 증가.
  insert into ledger_invite_acceptances (invite_id, user_id)
  values (v_invite.id, auth.uid())
  on conflict (invite_id, user_id) do nothing;
  if found then
    update ledger_invites set use_count = use_count + 1 where id = v_invite.id;
  end if;

  -- 수락 성공 → 이 사용자의 시도 기록 정리(정상 사용자가 rate limit 에 걸리지 않도록)
  delete from invite_accept_attempts where user_id = auth.uid();

  return v_invite.ledger_id;
end;
$function$;

revoke execute on function public.accept_ledger_invite(text) from anon, public;
grant execute on function public.accept_ledger_invite(text) to authenticated;
grant execute on function public.accept_ledger_invite(text) to service_role;

-- 초대 링크 폐기 (owner 전용)
create or replace function public.revoke_ledger_invite(p_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_ledger uuid;
begin
  if auth.uid() is null then
    raise exception '인증이 필요합니다.';
  end if;

  select ledger_id into v_ledger from ledger_invites where id = p_invite_id;
  if v_ledger is null then
    raise exception '초대를 찾을 수 없습니다.';
  end if;

  if not exists (
    select 1 from ledger_members
    where ledger_id = v_ledger and user_id = auth.uid()
      and role = 'owner' and deleted_at is null
  ) then
    raise exception '권한이 없습니다.';
  end if;

  update ledger_invites set status = 'revoked' where id = p_invite_id;
end;
$function$;

revoke execute on function public.revoke_ledger_invite(uuid) from anon, public;
grant execute on function public.revoke_ledger_invite(uuid) to authenticated;
grant execute on function public.revoke_ledger_invite(uuid) to service_role;
