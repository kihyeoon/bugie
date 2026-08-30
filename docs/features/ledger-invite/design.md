# 초대 코드/링크 방식 설계 (BGI-22)

부부/가족용 공유 가계부에서 **이메일을 몰라도** 상대를 가계부에 초대할 수 있게 한다.

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

- **목표**: 이메일 없이, 초대자가 만든 **초대 코드/링크**를 카톡·메시지로 전달 → 상대가 앱에서 수락 → 멤버 추가.
- **비목표**: 초대 알림 푸시, 초대 수락 대기열 UI, 다회용 팀 초대 링크(가족 규모엔 과함). 추후 별도.

## 3. 핵심 결정 — "코드"가 1차, "링크"는 보조

도메인(예: `bugie.app`)이 아직 없어 iOS **유니버설 링크(`https://…`)를 지금은 쓸 수 없다.**
커스텀 스킴 `bugie://`는 **카톡/iMessage에서 탭 자체가 안 될 가능성이 높다**(대부분의 메신저가
커스텀 스킴을 링크화하지 않음). 따라서:

- **초대 코드 입력을 1차 경로로** 둔다. 공유 메시지에 `ABCD-EFGH` 코드 + 안내문을 담고,
  받은 사람은 앱에서 "초대 코드 입력"으로 수락한다.
- `bugie://invite?code=…` 딥링크는 **보조**(탭 가능한 경로에서만 작동하는 편의).

이 구조의 이점: **미설치자(deferred deep link) 문제가 사라진다.** 배우자가 앱을 나중에 설치·가입한
뒤 코드만 입력하면 되므로, 링크 컨텍스트 보존(Branch·Detour류 미들웨어)이 불필요하다.

### 3.1 도메인 확보 시 업그레이드 경로 (A안)

도메인을 확보하면 유니버설 링크로 올려 "탭 한 번에 열림 + 미설치자 웹 랜딩 → App Store 유도"가 된다.
**이때 DB 스키마·RPC·수락 로직·코드 포맷은 그대로 재사용**하고, 추가되는 것만:

- `app.json` `ios.associatedDomains: ["applinks:bugie.app"]`
- `apps/web`에 `/.well-known/apple-app-site-association`(AASA) 호스팅 + `/invite` 랜딩 페이지
- 수락 라우트를 `app/invite.tsx`로 두면 `bugie://invite?code=` 와 `https://bugie.app/invite?code=` 양쪽이
  같은 화면으로 들어온다 → **B(코드) → A(링크) 무손실 업그레이드.**

| | A. 유니버설 링크 (도메인 필요) | B. 코드 1차 (도메인 불필요, v1 권장) |
|---|---|---|
| 카톡에서 탭 | ✅ 한 번에 앱 열림 | 코드 복붙 (탭 대신) |
| 미설치자 | 웹 랜딩 → App Store | 설치 후 코드 입력 |
| 추가 인프라 | 도메인 + AASA + 랜딩 | 없음 |
| DB/RPC/수락화면 | **공통 (재사용)** | **공통** |

## 4. 데이터 모델 — `ledger_invites`

```sql
create table public.ledger_invites (
  id          uuid primary key default gen_random_uuid(),
  ledger_id   uuid not null references public.ledgers(id)  on delete cascade,
  inviter_id  uuid not null references public.profiles(id) on delete cascade,
  code        text not null unique,                 -- 링크·수동입력 공용 (예: ABCDEFGH)
  role        member_role not null default 'member', -- text 아님: 하우스 enum
  status      text not null default 'pending',       -- pending | accepted | revoked
  expires_at  timestamptz not null default now() + interval '7 days',
  accepted_by uuid references public.profiles(id),
  accepted_at timestamptz,
  created_at  timestamptz not null default now()
);
create index idx_ledger_invites_code   on public.ledger_invites(code) where status = 'pending';
create index idx_ledger_invites_ledger on public.ledger_invites(ledger_id);
```

- **코드**: 생성 RPC 본문에서 `gen_random_bytes`(pgcrypto, Supabase 기본 활성)로 생성. 혼동 문자
  (0/O, 1/I/L) 제외한 base32 계열 **8자 ≈ 40비트**. 1회용 + 7일 만료 + 수락 실패 rate limit 조합이면
  가족앱 위협모델에 충분. 표기는 `ABCD-EFGH`, 저장은 하이픈 없이.
- **1회용**: 수락 시 `status='accepted'`로 소진. 재초대는 새 코드 발급.

## 5. RPC (전부 `SECURITY DEFINER`, BGI-37/38 규약)

피초대자는 아직 멤버가 아니라 일반 RLS로는 코드 조회·수락이 막힌다 → DEFINER RPC로 처리.
공통 규약: `revoke execute … from anon, public` 후 `authenticated`에만 부여, 본문 `auth.uid() is null`
선차단, `set search_path = public`, uuid 비교는 `is distinct from`.

### 5.1 `create_ledger_invite(p_ledger_id uuid, p_role member_role default 'member') → text`
- `auth.uid() is null` → 예외.
- 호출자가 해당 가계부 **owner** 인지 검사 (앱 `PermissionService.inviteMember: ['owner']`와 정렬 — DB도 owner 전용).
- 활성 pending 초대 상한(예: 가계부당 10건) 초과 시 예외 — 남용 방지.
- `gen_random_bytes`로 unique 코드 생성(충돌 시 재시도) → row insert → **코드 반환**.

### 5.2 `accept_ledger_invite(p_code text) → uuid`  (참여한 ledger_id 반환)
- `auth.uid() is null` → 예외.
- `select … from ledger_invites where code = p_code and status='pending' and expires_at > now() for update;`
  (**`for update` 행 잠금**으로 동시 수락 경합 방지). 없으면 **단일 일반 에러**('유효하지 않거나 만료된 초대입니다')
  로 상태 비노출.
- **멤버 upsert (soft-delete 재가입 버그 주의)**:
  ```sql
  insert into ledger_members (ledger_id, user_id, role)
  values (v.ledger_id, auth.uid(), v.role)
  on conflict (ledger_id, user_id) do update set
    role = excluded.role, deleted_at = null;   -- DO NOTHING 아님! 탈퇴 후 재가입 복원
  ```
- `update ledger_invites set status='accepted', accepted_by=auth.uid(), accepted_at=now() where id=v.id;`
- 수락 실패(잘못된 코드) 시도는 `auth.uid()`별 실패 카운트로 rate limit(브루트포스 차단).

### 5.3 폐기(revoke)
- 별도 RPC 없이 **RLS로 owner가 직접 `update ledger_invites set status='revoked'`**.
- RLS(관리): `ledger_id`가 호출자가 owner인 가계부일 때만 select/update 허용.

## 6. 앱 흐름

### 6.1 초대 생성 (기존 `InviteMemberModal` 교체)
- owner가 "초대하기" → `create_ledger_invite` 호출 → 코드/링크 확보.
- **iOS 공유 시트**(`Share.share({ message })`, RN 내장·설치 불필요)로 카톡·iMessage 위임.
  메시지: `"철수님이 '우리집 가계부'에 초대했어요. 코드: ABCD-EFGH\n(bugie://invite?code=ABCDEFGH)"`.
- **복사 fallback**: `expo-clipboard`(신규 설치) `setStringAsync` + "복사됨" 토스트. 링크/코드 항상 함께 노출.

### 6.2 초대 수락 — 코드 입력 화면 `app/accept-invite.tsx` (신규)
- 로그인 상태에서 `ABCD-EFGH` 입력 → `accept_ledger_invite` → 성공 시 해당 가계부로 이동 + `refreshLedgers`.
- 진입점: 더보기/가계부 관리에 "초대 코드 입력" 버튼.

### 6.3 딥링크 수신 `app/invite.tsx` (신규, 보조)
- `bugie://invite?code=…` → `useLocalSearchParams<{code}>` → 로그인 상태면 `accept-invite`로 코드 프리필,
  **비로그인이면 로그인/가입 유도 후 코드 프리필 상태로 재개**.
- A안(도메인) 업그레이드 시 이 라우트가 `https://bugie.app/invite?code=` 도 함께 수신.

### 6.4 core 레이어
- `LedgerService`에 `createInvite(ledgerId, role)` / `acceptInvite(code)` 추가.
- `LedgerRepository`에 `create_ledger_invite` / `accept_ledger_invite` RPC 호출부 추가.
- 기존 `inviteMemberByEmail`(이메일 방식)은 **보조로 유지**(가입자 이메일을 아는 경우). 제거하지 않음.

## 7. 마이그레이션 / 릴리즈 순서

- 마이그레이션(테이블 + RPC 3종): **CLAUDE.md 표준 템플릿 — GRANT + RLS 둘 다**, DEFINER RPC는 anon/PUBLIC revoke.
- **DB를 앱보다 먼저 배포해도 무해**(호출자 없으면 inert — BGI-36 패턴). 앱 코드는 BGI-35/36과 같은 다음 릴리즈에 합류.
- `expo-clipboard` 설치는 앱 변경분에 포함.

## 8. 결정 사항

1. **링크 방식: B(코드 1차 v1) 확정** (2026-08-30). 도메인 없이 코드 방식으로 구현하고, 딥링크는 보조.
   도메인 확보 시 A(유니버설 링크)로 무손실 업그레이드(§3.1) — 스키마·RPC·수락화면·코드포맷 재사용.
2. 기본값으로 진행: 초대 코드 만료 **7일**, 가계부당 pending 초대 상한 **10건**. 가계부 최대 멤버 수 상한은 v1 범위 밖(추후).
3. (블로킹 아님) `bugie://invite?code=test` 카톡 탭 가능 여부는 실기기에서 확인 — 안 되면 딥링크 보조 경로만 무효, 코드 입력 1차 경로는 그대로 성립.

## 9. 다음 스텝

도메인 결정(§8-1) 후: 마이그레이션 작성 → 로컬 검증(수락/만료/권한/soft-delete 재가입) → dry-run → push,
그다음 앱 화면 구현. 스펙 기반 개발(`docs/spec-workflow.md`)로 태울지 여부도 확정.
