# 초대 코드/링크 방식 설계 (BGI-22)

부부/가족용 공유 가계부에서 **이메일을 몰라도** 상대를 가계부에 초대할 수 있게 한다.

> 개정 이력: 2026-08-30 초안 → QA·측면검토·사용자 결정 반영으로 개정(다회용 링크, 딥링크 경량 포함, 이메일 보조 개선).

## 1. 문제 (프로덕션 실측 2026-08-30)

현재 초대는 상대 이메일을 직접 입력해 `profiles.email` 정확 일치로 찾는 방식이다
(`invite_member_to_ledger` RPC + `InviteMemberModal`).

| provider | 유저 | Private Relay 이메일 | 실제 이메일 |
|---|---|---|---|
| apple | 25 | **23 (92%)** | 2 |
| google | 12 | 0 | 12 |

- 전체 37명 중 **23명(62%)이 `@privaterelay.appleid.com`** → 아무도 그 주소를 모름
- 즉 **초대 대상의 62%를 현행 방식으로는 초대할 수 없다.** 공유 앱의 핵심 기능이 막힌 상태.

## 2. 목표 / 비목표

- **목표**: 이메일 없이, 초대자가 만든 **다회용 초대 코드/링크**를 카톡·메시지로 전달 → 상대가 앱에서
  수락 → 멤버 추가. 초대자는 그 링크로 들어온 사람을 확인하고 링크를 폐기할 수 있다.
- **목표(보조)**: 기존 이메일 초대 유지 + **프로필에서 내 이메일 복사/공유**(잘림 해결). 가입자가
  자기 이메일(relay 포함)을 주인에게 카톡으로 넘겨 기존 이메일 초대를 받게 하는 경로.
- **비목표**: 초대 알림 푸시, 수락 대기열/승인 UI, 미가입자 역방향 참가요청, **관계 종료 시 멤버 제거·
  데이터 분리**(별도 이슈). 도메인 기반 유니버설 링크(추후, §3.1).

## 3. 핵심 결정 — 코드 입력 1차 + 딥링크(경량) 병행

도메인(예: `bugie.app`)이 아직 없어 iOS **유니버설 링크(`https://…`)를 지금은 쓸 수 없다.**
커스텀 스킴 `bugie://`만 가능한데, 이것이 **카톡에서 탭되는지는 실기기 확인이 필요하다**(시뮬레이터
불가). 그래서 두 경로를 함께 둔다:

- **코드 입력을 1차 경로로**: 공유 메시지에 `ABCD-EFGH-IJKL` 코드 + 안내문을 담고, 받은 사람은
  앱에서 "초대 코드 입력"으로 수락한다. 카톡 탭 여부·설치 여부와 무관하게 항상 성립.
- **`bugie://invite?code=…` 딥링크는 병행(경량)**: 아래 표대로 로그인 사용자는 탭 한 번에 수락,
  비로그인은 코드 입력으로 폴백한다. **무거운 코드 보존 로직을 두지 않는다**(그래서 초기 QA가 지적한
  "비로그인 딥링크 보존" 복잡성이 v1 범위에서 사라진다).

| 딥링크 진입 상황 | v1 동작 |
|---|---|
| 로그인 상태(가장 흔함) | 수락 화면으로 이동 + 코드 자동 입력 → 즉시 수락 |
| 비로그인/미설치 | 로그인·설치 유도. 이후 **코드 입력으로 폴백**(보존 로직 없음) |

실기기 확인 결과: 카톡에서 `bugie://`가 탭되면 카톡까지 원터치, 안 되면 iMessage·메모 등에서만
원터치이고 카톡은 코드 입력 폴백 — 어느 쪽이든 손해 없다.

### 3.1 도메인 확보 시 업그레이드 경로 (추후)

도메인을 확보하면 유니버설 링크(`https://bugie.app/invite?code=`)로 올려 "카톡 원터치 + 미설치자
웹 랜딩 → App Store"가 된다. **DB 스키마·RPC·수락 화면·코드 포맷·딥링크 라우트(`app/invite.tsx`)는
그대로 재사용**하고, 추가되는 것만: `app.json` `ios.associatedDomains`, `apps/web`에 AASA 파일 +
`/invite` 랜딩. → 무손실 업그레이드.

## 4. 데이터 모델

### 4.1 `ledger_invites` — 다회용 초대 링크

```sql
create table public.ledger_invites (
  id          uuid primary key default gen_random_uuid(),
  ledger_id   uuid not null references public.ledgers(id)  on delete cascade,
  inviter_id  uuid not null references public.profiles(id) on delete set null,  -- 발급자 탈퇴해도 링크 이력 보존
  code        text not null unique,                  -- 정규화 저장(대문자·영숫자만). 표기는 ABCD-EFGH-IJKL
  role        member_role not null default 'member', -- 하우스 enum (text 아님)
  status      text not null default 'active',        -- active | revoked  (만료는 expires_at)
  max_uses    integer,                               -- null = 무제한, 값 있으면 사용 상한
  use_count   integer not null default 0,
  expires_at  timestamptz not null default now() + interval '7 days',
  created_at  timestamptz not null default now()
);
create index idx_ledger_invites_code   on public.ledger_invites(code) where status = 'active';
create index idx_ledger_invites_ledger on public.ledger_invites(ledger_id);
```

- **코드**: 생성 RPC 본문에서 `gen_random_bytes`(pgcrypto, Supabase 기본 활성)로 생성. 혼동 문자
  (0/O, 1/I/L) 제외한 base32 계열 **12자 ≈ 60비트**(다회용·장기 유효라 40비트보다 상향). 표기는
  4자씩 `ABCD-EFGH-IJKL`, 저장은 하이픈 없이 대문자.
- **다회용**: `status='active'` 이고 미만료이며 `use_count < max_uses`(또는 무제한)면 계속 수락 가능.
  1회용이 필요하면 `max_uses=1`로 발급.

### 4.2 `ledger_invite_acceptances` — 누가 이 링크로 들어왔나

```sql
create table public.ledger_invite_acceptances (
  id          uuid primary key default gen_random_uuid(),
  invite_id   uuid not null references public.ledger_invites(id) on delete cascade,
  user_id     uuid not null references public.profiles(id)       on delete cascade,
  accepted_at timestamptz not null default now(),
  unique (invite_id, user_id)   -- 같은 링크 중복 수락 방지
);
```

### 4.3 `invite_accept_attempts` — 수락 실패 rate limit

```sql
create table public.invite_accept_attempts (
  user_id      uuid not null references public.profiles(id) on delete cascade,
  attempted_at timestamptz not null default now()
);
create index idx_invite_attempts_user_time on public.invite_accept_attempts(user_id, attempted_at);
```

전부 CLAUDE.md 표준 템플릿대로 **GRANT + RLS 둘 다**. 조회는 RLS(authenticated에 `select` GRANT),
생성·수락·폐기의 쓰기는 DEFINER RPC가 전담(테이블 직접 insert/update/delete GRANT는 authenticated에
주지 않음).

## 5. RPC (전부 `SECURITY DEFINER`, BGI-37/38 규약)

공통 규약: `revoke execute … from anon, public` 후 `authenticated`에만 부여, 본문 `auth.uid() is null`
선차단, `set search_path = public`, uuid 비교는 `is distinct from`.

### 5.1 `create_ledger_invite(p_ledger_id uuid, p_role member_role default 'member', p_max_uses integer default null) → text`
- `auth.uid() is null` → 예외.
- 호출자가 해당 가계부 **owner** 인지 검사(앱 `PermissionService.inviteMember: ['owner']`와 정렬 — DB도 owner 전용).
- 활성 초대 상한(예: 가계부당 active 10건) 초과 시 예외 — 남용 방지.
- `gen_random_bytes`로 unique 코드 생성(충돌 시 재시도) → row insert → **코드 반환**.

### 5.2 `accept_ledger_invite(p_code text) → uuid`  (참여한 ledger_id 반환)
- `auth.uid() is null` → 예외.
- **코드 정규화**: `upper(regexp_replace(p_code, '[^A-Za-z0-9]', '', 'g'))` — 표기용 하이픈·공백·소문자 흡수.
- **rate limit**: 최근 10분 내 이 `auth.uid()`의 실패가 임계(예: 10회) 이상이면 예외. (per-user + 필요 시 전역 상한)
- `select … from ledger_invites where code = 정규화코드 and status='active' and expires_at > now() for update;`
  (**`for update` 행 잠금**으로 동시 수락 경합 방지). 없으면 → 실패 기록(`invite_accept_attempts` insert) 후
  **단일 일반 에러**('유효하지 않거나 만료된 초대입니다')로 상태 비노출.
- **사용 상한 검사**: `max_uses`가 있고 `use_count >= max_uses` → 예외('초대 정원이 찼습니다').
- **inviter 권한 재검증**: `inviter_id`가 여전히 이 가계부의 활성 owner인지 확인. 아니면 예외(또는 자동
  `status='revoked'`) — 나간/강등된 사람의 초대가 권한을 부여하지 못하게.
- **멤버 upsert (권한 강등 방지 + soft-delete 복원)**:
  ```sql
  insert into ledger_members (ledger_id, user_id, role)
  values (v.ledger_id, auth.uid(), v.role)
  on conflict (ledger_id, user_id) do update
    set role = excluded.role, deleted_at = null
    where ledger_members.deleted_at is not null;  -- 탈퇴 복원에만 role 재설정
  -- 이미 active 멤버면 위 update는 where로 스킵 → 기존 role 보존(owner 강등 방지)
  ```
- 수락 기록: `insert into ledger_invite_acceptances (invite_id, user_id) values (v.id, auth.uid()) on conflict do nothing;`
  신규 기록이 생겼을 때만 `update ledger_invites set use_count = use_count + 1 where id = v.id;`
- **return** `v.ledger_id` (이미 멤버였어도 그 가계부로 이동시키면 되므로 앱 UX는 동일).

### 5.3 `revoke_ledger_invite(p_invite_id uuid) → void`
- `auth.uid() is null` → 예외. 호출자가 해당 가계부 owner인지 검사 → `status='revoked'`.
- 별도 테이블 직접 UPDATE(초기안)를 폐기하고 **DEFINER RPC로 통일** — 하우스 규약 정합 + 컬럼 변조 방지.

### 5.4 조회 (RLS)
- **초대 목록·수락자 목록은 RLS `select`로** owner/admin에게만 노출:
  - `ledger_invites`, `ledger_invite_acceptances` 모두 "호출자가 owner/admin인 가계부의 행"만 select 허용.
- 앱은 `LedgerRepository`에서 `ledger_invites` + `ledger_invite_acceptances(user_id→profiles)` 중첩 조회로
  "활성 링크 + 각 링크로 들어온 사람"을 그린다.

## 6. 앱 흐름

### 6.1 초대 링크 생성 (기존 `InviteMemberModal` 개편)
- owner가 "초대 링크 만들기" → `create_ledger_invite` → 코드/링크 확보.
- **iOS 공유 시트**(`Share.share({ message })`, RN 내장·설치 불필요)로 카톡·iMessage 위임.
  메시지: `"철수님이 '우리집 가계부'에 초대했어요. 코드: ABCD-EFGH-IJKL\n(bugie://invite?code=ABCDEFGHIJKL)"`.
- **복사 fallback**: `expo-clipboard`(신규 설치) `setStringAsync` + "복사됨" 토스트.

### 6.2 초대 관리 (가계부 설정 내, 신규 섹션)
- **활성 초대 링크 목록** + 각 링크의 **수락자 목록**(누가 언제 들어왔는지) 조회(§5.4 RLS).
- 각 링크 **폐기(revoke)** 버튼 → `revoke_ledger_invite`.

### 6.3 초대 수락 — 코드 입력 화면 `app/accept-invite.tsx` (신규)
- 로그인 상태에서 `ABCD-EFGH-IJKL` 입력(하이픈 자동 정리) → `accept_ledger_invite` → 성공 시 해당
  가계부로 이동 + `refreshLedgers`. 실패 시 단일 안내 메시지.
- 진입점: 더보기/가계부 관리에 "초대 코드 입력" 버튼.

### 6.4 딥링크 수신 `app/invite.tsx` (신규, 경량)
- `bugie://invite?code=…` → `useLocalSearchParams<{code}>`.
  - **로그인 상태**: `accept-invite`로 코드 프리필(또는 즉시 수락) → 원터치.
  - **비로그인**: 로그인/가입 화면으로 유도. 보존 로직 없이, 이후 **코드 입력으로 폴백**.
- (도메인 확보 시 이 라우트가 `https://bugie.app/invite?code=` 도 함께 수신 — §3.1)

### 6.5 이메일 보조 개선 (프로필)
- `profile-settings`에서 **내 이메일 복사 / 공유** 버튼 추가(잘림 해결). 가입자가 자기 이메일(relay 포함)을
  주인에게 카톡으로 넘기면, 주인이 기존 `invite_member_to_ledger`(이메일)로 초대. 기존 이메일 경로는 유지.

### 6.6 core 레이어
- `LedgerService`: `createInvite(ledgerId, role, maxUses?)` / `acceptInvite(code)` / `revokeInvite(inviteId)` /
  `listInvites(ledgerId)`(수락자 포함) 추가.
- `LedgerRepository`: 해당 RPC 호출부 + 조회 쿼리. 기존 `inviteMemberByEmail`은 보조로 유지.

## 7. 마이그레이션 / 릴리즈 순서

- 마이그레이션(테이블 3종 + RPC 3종 + RLS/GRANT): **CLAUDE.md 표준 템플릿 — GRANT + RLS 둘 다**,
  DEFINER RPC는 anon/PUBLIC revoke.
- **DB를 앱보다 먼저 배포해도 무해**(호출자 없으면 inert — BGI-36 패턴). 앱 코드는 BGI-35/36과 같은 다음 릴리즈에 합류.
- `expo-clipboard` 설치는 앱 변경분에 포함. 딥링크는 네이티브 설정 없이 기존 `scheme: "bugie"`로 동작.

## 8. 결정 사항

1. **다회용 링크** 채택 — 수락자 목록 조회 + 링크 폐기 지원. `max_uses=1`로 1회용도 가능.
2. **딥링크 v1 포함(경량)** — 로그인 자동수락 / 비로그인 코드입력 폴백. 무거운 보존 로직 없음.
3. **이메일 보조 유지 + 개선** — 프로필에서 내 이메일 복사/공유(주인에게 전달용).
4. 기본값: 초대 만료 **7일**, 가계부당 active 초대 상한 **10건**, 코드 **12자(≈60bit)**. 멤버 수 상한은 v1 범위 밖.
5. 관계 종료 시 멤버 제거·데이터 분리는 **범위 제외**(별도 이슈).
6. (구현 초반 확인) `bugie://invite?code=test` 카톡 탭 가능 여부 실기기 점검 — 안 돼도 코드입력 폴백으로 무해.

## 9. 열린 항목 (구현 중 확정)

- inviter 권한 상실 시 "예외로 거부" vs "자동 revoke" 중 택1 (§5.2).
- rate limit 임계값(10분/10회)·전역 상한 여부.
- 초대 관리 UI를 `ledger-settings` 내 섹션으로 둘지 별도 화면으로 둘지.

## 10. 다음 스텝

마이그레이션 작성 → 로컬 검증(수락/만료/정원/권한/강등방지/soft-delete 복원/정규화/rate limit) → dry-run →
push, 그다음 앱 화면 구현(생성·관리·코드입력·딥링크·프로필 이메일). 각 단계 확인받으며 진행.
