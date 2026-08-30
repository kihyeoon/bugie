-- BGI-37 ② 침투 차단: 권한 검사의 NULL fail-open 수정
--
-- invite_member_to_ledger 와 transfer_ledger_ownership 는 SECURITY DEFINER 라 RLS 를
-- 우회한다. 두 함수 모두 "호출자가 owner/admin 인가"를 검사하지만, 비로그인(anon) 호출이면
-- auth.uid() 가 NULL 이라 검사가 무력화된다:
--   - NOT IN:  NULL NOT IN (...) → NULL → IF 가 거짓 취급 → RAISE 건너뜀
--   - !=:      <uuid> != NULL     → NULL → IF 가 거짓 취급 → RAISE 건너뜀
-- 결과적으로 로그인 없이 남의 가계부에 owner 로 진입/소유권 이전이 가능했다.
-- (BGI-37 ① 로 명단 노출은 막았지만, uuid 를 아는 전 멤버/내부자에게는 여전히 열려 있다.)
--
-- 수정: ① 최상단에서 auth.uid() IS NULL 을 먼저 끊는다(1차 방어).
--       ② NULL 에서 거짓이 되는 비교로 바꾼다(심층 방어): IS NULL 명시 / IS DISTINCT FROM.
--
-- 주의: 아래 본문은 '현재 프로덕션에 살아있는' 정의를 기준으로 최소 수정만 얹은 것이다.
-- 마이그레이션 20250831000001 의 파일 본문은 프로덕션과 다르다(적용 후 대시보드 수정 드리프트).
-- 여기서 프로덕션 기준으로 재정의하므로 로컬/프로덕션이 이 버전으로 재수렴한다.

-- ============================================================================
-- invite_member_to_ledger
-- ============================================================================
CREATE OR REPLACE FUNCTION public.invite_member_to_ledger(
  target_ledger_id uuid,
  target_user_email text,
  member_role member_role DEFAULT 'member'::member_role
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
declare
  target_user_id uuid;
  current_user_role member_role;
begin
  -- 비로그인 차단 (1차 방어). 이게 없으면 아래 NOT IN 이 NULL 로 통과된다.
  if auth.uid() is null then
    raise exception '인증이 필요합니다.';
  end if;

  -- 현재 사용자가 초대 권한이 있는지 확인
  select role into current_user_role
  from ledger_members
  where ledger_id = target_ledger_id
    and user_id = auth.uid()
    and deleted_at is null;

  -- 멤버가 아니면 current_user_role 은 NULL 이다. NOT IN 만으로는 NULL 이 통과하므로
  -- IS NULL 을 명시적으로 함께 막는다 (심층 방어).
  if current_user_role is null or current_user_role not in ('owner', 'admin') then
    raise exception '권한이 없습니다.';
  end if;

  -- 초대할 사용자 ID 찾기
  select id into target_user_id
  from profiles
  where email = target_user_email and deleted_at is null;

  if target_user_id is null then
    raise exception '사용자를 찾을 수 없습니다.';
  end if;

  -- 멤버 추가
  insert into ledger_members (ledger_id, user_id, role)
  values (target_ledger_id, target_user_id, member_role)
  on conflict (ledger_id, user_id) do update set
    role = excluded.role,
    deleted_at = null;

  return true;
end;
$function$;

-- ============================================================================
-- transfer_ledger_ownership
-- ============================================================================
CREATE OR REPLACE FUNCTION public.transfer_ledger_ownership(
  p_ledger_id uuid,
  p_new_owner_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_current_owner_id UUID;
  v_new_owner_exists BOOLEAN;
BEGIN
  -- 비로그인 차단 (1차 방어). 이게 없으면 아래 != 비교가 NULL 로 통과된다.
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION '인증이 필요합니다.';
  END IF;

  -- 1. 현재 사용자가 owner인지 확인
  SELECT user_id INTO v_current_owner_id
  FROM ledger_members
  WHERE ledger_id = p_ledger_id
    AND role = 'owner'
    AND deleted_at IS NULL
  LIMIT 1;

  IF v_current_owner_id IS NULL THEN
    RAISE EXCEPTION '가계부 소유자를 찾을 수 없습니다.';
  END IF;

  -- IS DISTINCT FROM: != 는 auth.uid() 가 NULL 이면 결과가 NULL 이라 IF 를 건너뛴다(심층 방어).
  IF v_current_owner_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION '소유자 권한을 이전할 권한이 없습니다.';
  END IF;

  -- 2. 새 소유자가 해당 가계부의 멤버인지 확인
  SELECT EXISTS (
    SELECT 1
    FROM ledger_members
    WHERE ledger_id = p_ledger_id
      AND user_id = p_new_owner_id
      AND deleted_at IS NULL
  ) INTO v_new_owner_exists;

  IF NOT v_new_owner_exists THEN
    RAISE EXCEPTION '새 소유자가 가계부 멤버가 아닙니다.';
  END IF;

  -- 3. 자기 자신에게 이전 방지
  IF v_current_owner_id = p_new_owner_id THEN
    RAISE EXCEPTION '자기 자신에게는 권한을 이전할 수 없습니다.';
  END IF;

  -- 4. 트랜잭션으로 권한 교체 (원자적 처리)
  UPDATE ledger_members
  SET role = 'member'
  WHERE ledger_id = p_ledger_id
    AND user_id = v_current_owner_id
    AND deleted_at IS NULL;

  UPDATE ledger_members
  SET role = 'owner'
  WHERE ledger_id = p_ledger_id
    AND user_id = p_new_owner_id
    AND deleted_at IS NULL;

  -- 5. 가계부 updated_at 갱신
  UPDATE ledgers
  SET updated_at = NOW()
  WHERE id = p_ledger_id;

END;
$function$;
