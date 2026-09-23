# 가입 시 닉네임 설정 단계 (BGI-40)

신규 가입자가 Bugie에서 쓸 닉네임을 직접 정하게 한다. 애플 가입자 이름이 `vtnh59jpv9` 같은 무작위 문자열로
저장돼 공유 가계부 상대방에게 그대로 보이는 문제를 고친다.

> 개정 이력: 2026-09-23 재조사 → 2026-09-24 사용자 결정 반영 → 2026-09-24 4개 관점 리뷰(인증 흐름, DB·배포,
> UX·심사, 단순성·범위) 반영(§9).

## 1. 문제 (프로덕션 실측 2026-09-23, 탈퇴자 제외)

| provider | 전체 | 이름 = 이메일 앞부분 | 나중에 직접 수정 |
|---|---|---|---|
| apple | 28 | **13** (거래 있음 6, 공유 가계부 3) | 12 |
| google | 12 | 0 | 1 |

- 기본 가계부 이름이 `이메일앞부분의 가계부`인 가계부가 17개 있다. 전부 각 사용자의 첫 가계부다.
- 이 이름은 홈 상단, 가계부 선택 목록, **초대 메시지**(`'vtnh59jpv9의 가계부'에 초대합니다.`)에 나온다.

### 원인 1. 애플 이름이 도착하기 전에 프로필이 먼저 만들어진다

1. `authService.handleAppleSignIn`이 애플 자격 증명(`fullName` 포함)을 받고 `signInWithIdToken`을 호출한다.
2. auth-js 2.71.1의 `signInWithIdToken`은 `SIGNED_IN` 리스너가 **끝날 때까지 기다린다**(`GoTrueClient.js:668-670`, `1761-1778`).
3. `AuthContext` 리스너가 `ensureProfile`을 **애플 이름 없이** 호출한다. 그래서 `create_user_profile`이 이메일 앞부분으로
   프로필을 만들고, `setup_new_user`가 `이메일앞부분의 가계부`를 만든다.
4. 그 뒤에 `handleAppleSignIn`이 `ensureProfile(..., { fullName })`을 호출하지만, 프로필이 이미 있어서 이름이 무시된다.

애플 로그인을 도입한 2025-10-21부터 한 번도 동작하지 않았다. 로그인 중에는 lock을 잡지 않으므로, 리스너 안의
`getUser`가 교착되지는 않는다(리뷰에서 확인).

### 원인 2. 판정이 "이름이 있는가"다

`needsProfile = !profile.full_name`이라 무작위 문자열도 통과한다. 그래서 `(auth)/profile-setup.tsx`가 거의 뜨지 않는다.

## 2. 결정 사항

| 항목 | 결정 |
|---|---|
| 누구에게 보여줄지 | **모든 신규 가입자.** `profiles.onboarded_at`이 null이면 보여준다 |
| 기존 사용자 | **이름이 이메일 앞부분인 사람만** 한 번 보여준다. 나머지는 완료 처리한다 |
| 입력칸 기본값 | 제공자가 준 이름(애플 `fullName`, 구글 메타데이터)을 규칙에 맞게 정리한 값. 이메일 앞부분이거나 정리해도 규칙에 안 맞으면 빈칸 |
| 기본 가계부 이름 | 닉네임 화면에서 저장할 때만 함께 바꾼다(§5.3) |
| seed | 김철수·이영희는 완료, 미완료 테스트 사용자 1명 추가 |

**비목표** (별도 이슈 후보)
- 프로필 사진(BGI-46)
- 인증 화면 다크 모드: `(auth)` 그룹 전체가 흰색으로 고정돼 있다
- 비로그인 상태에서 연 초대 링크의 코드를 가입 뒤에 이어받기. BGI-22의 경량 설계를 유지한다
- 프로필이 없는 로그인(null 프로필)을 오류 화면으로 처리하기. 기존 동작(설정 화면으로 보냄)을 유지한다(§5.2)
- 생성 타입 `database-generated.ts` 전체 재생성. 2026-03 이후 갱신되지 않아 관계없는 diff가 섞인다
- 콜드 스타트에 `ensureProfile`이 동시에 두 번 돌아 가계부가 2개 생길 수 있는 기존 경쟁 상태

## 3. 가입 플로우

```
로그인 화면 ─ 애플 ─▶ 이름 정리 → rememberSignupName ─▶ signInWithIdToken ─▶ finally: 이름 비움
   │                                                      └ SIGNED_IN 리스너(여기서 await됨)
   │                                                         └ ensureProfile: 새 프로필이면 보관된 이름 사용
   └ 구글 ─▶ signInWithIdToken ─▶ 리스너 → ensureProfile(메타데이터 이름)
                 ▼
      상태 세팅: profile(onboarded_at = null) → needsProfile = true
                 ▼
      login.tsx effect ─▶ 닉네임 화면 (이동은 여기 한 곳)
                 ▼
      시작하기: ① profiles(full_name, onboarded_at) 저장 → 저장된 행으로 상태 갱신
                ② 기본 가계부 이름 변경(해당할 때만, 실패해도 계속)
                ③ refreshLedgers
                 ▼
      needsProfile = false ─▶ 화면의 effect가 홈(또는 초대 수락)으로 이동
```

| 경우 | 기본값 | 가계부 안내 줄 |
|---|---|---|
| 애플, 이름 공유 | `홍길동` | 닉네임을 바꿀 때만 |
| 애플, 이름 지움 / 재가입(애플은 첫 승인 때만 이름을 줌) | 빈칸 | 입력하면 |
| 구글 | 구글 이름 | 닉네임을 바꿀 때만 |
| 기존 사용자 중 이메일 앞부분 이름(13명) | 빈칸 | 입력하면 |

**기존 13명이 언제 화면을 보는가.**
- DB를 먼저 배포하면 옛 앱(1.4.0)도 `select('*')`로 `onboarded_at: null`을 받아 캐시에 저장한다(`AuthContext.tsx:110-111`).
  그래서 그 사이 옛 앱을 한 번이라도 연 사람은 **새 앱 첫 실행부터** 화면을 본다.
- 그러지 않은 사람은 첫 실행에서 키가 없는 캐시로 통과하고, **두 번째 실행**부터 본다.
- 어느 쪽이든 쓰고 있던 화면이 갑자기 바뀌지는 않는다. 탭 화면에는 `needsProfile`을 보는 곳이 없다.

## 4. 닉네임 화면 (`app/(auth)/profile-setup.tsx` 재작성)

```
  Bugie에서 쓸 닉네임을 정해주세요
  함께 쓰는 사람에게 이 닉네임으로 보여요.
  나중에 설정에서 바꿀 수 있어요.
  지금은 vtnh59jpv9로 보이고 있어요         ← 기본값이 빈칸이고 현재 이름이 있을 때만

  닉네임
  [ 길동                  ⓧ ]              ← 기본값 '홍길동'을 '길동'으로 고친 상태
  가계부 이름도 '길동의 가계부'로 바뀌어요   ← 현재 이름과 다르고 해당할 때만

  [        시작하기        ]
            다른 계정으로 로그인           ← 로그아웃 후 로그인 화면으로
```

- **검증**: `ProfileRules.validateNickname`을 쓴다(`/^[가-힣a-zA-Z0-9\s]+$/`, 2~20자, 연속 공백 금지).
  - 입력 중에는 오류를 보여주지 않는다. 한글 조합 중간 상태(`길ㄷ`)가 규칙에 걸려 오류가 깜빡이기 때문이다.
  - 버튼은 저장 중일 때와 입력이 비었을 때만 꺼진다. 누르면 검증하고, 실패하면 입력칸 아래에 오류를 보여준다.
    말없이 꺼진 버튼이 생기지 않는다.
  - 오류는 입력을 바꾸면 지운다. 문구는 도메인 규칙(`ProfileRules`)의 것을 그대로 쓴다. 프로필 설정의 닉네임 수정과
    같은 문구를 보여주기 위해서다(해요체로 바꾸려면 메시지 문자열에 의존하는 매핑이 필요해 하지 않았다).
- **가계부 안내 줄**
  - 표시 조건: 입력값(trim)이 규칙을 통과하고, 현재 이름과 다르고, `findDefaultLedger`가 찾은 가계부가 있을 때만.
  - 오류가 있으면 오류가 먼저 보인다.
- **이동**
  - `needsProfile`이 false가 되면 effect가 이동한다. 대상은 `code` 파라미터가 있으면 초대 수락 화면, 없으면 홈이다.
  - 저장이 끝났을 때와, 서버에 이미 완료 기록이 있는 경우(다른 기기에서 완료, 캐시만 옛 값)를 같은 길로 처리한다.
- **입력칸**: `autoFocus`, `autoCorrect={false}`, `textContentType="nickname"`, `clearButtonMode="while-editing"`,
  `returnKeyType="done"`, `maxLength`는 두지 않는다(iOS 한글 조합 끝 글자 잘림, 길이는 검증이 처리).
- **저장 중**: 버튼에 로딩을 표시한다. `onSubmitEditing`도 막아 두 번 제출되지 않게 한다. 실패하면 알림을 한 번 띄우고 화면에 남는다.
- **접근성**: 제목 `accessibilityRole="header"`, 입력칸 `accessibilityLabel`, 버튼 `accessibilityState={{ disabled, busy }}`.
  제목은 `\n`으로 강제 줄바꿈하지 않는다(큰 글씨).
- **색**: `(auth)` 그룹이 흰 배경과 어두운 상태바로 고정돼 있으므로 `Colors.light`의 시맨틱 토큰을 쓴다.
  그룹 전체 다크 모드는 비목표다.
- `Pressable`, `useHideSplashOnMount`, `KeyboardAvoidingView`를 쓴다.

## 5. 설계

### 5.1 DB — 마이그레이션 1개

`supabase/migrations/20260924000001_add_profiles_onboarded_at.sql`

```sql
alter table public.profiles add column onboarded_at timestamptz;

-- 이름이 이메일 앞부분이 아닌 기존 사용자는 이미 이름을 정한 것으로 본다.
update public.profiles
set onboarded_at = coalesce(created_at, now())
where full_name is not null
  and full_name <> split_part(email, '@', 1);
```

- 기존 테이블에 컬럼만 추가하므로 GRANT·RLS를 바꾸지 않는다.
  - 테이블 단위 GRANT가 새 컬럼도 포함한다.
  - `profiles_own_all` 정책이 본인 행 수정만 허용한다. 이 값은 UX 게이트일 뿐이라 본인이 바꿔도 위험이 없다.
  - 같은 가계부 멤버도 이 값을 읽을 수 있지만(`profiles_ledger_members_select`), 이메일이 이미 보이는 수준이라 추가 위험은 미미하다.
- 새 DB 함수는 없다. default 없는 nullable 컬럼이라 메타데이터만 바뀌고 잠금이 짧다.
  PostgREST 스키마 캐시는 `pgrst_ddl_watch`가 자동으로 다시 읽는다.
- 영향 확인: profiles에 의존하는 뷰는 `active_transactions` 하나이고, 컬럼을 명시해서 쓴다.
- 백필 조건의 빈틈(이메일 null이나 빈 문자열, `created_at` null, 앞뒤 공백)은 프로덕션에서 모두 0건이다(09-24).
- **배포는 DB 먼저, 앱 나중이다.** 순서가 바뀌어도 §5.2의 규칙 덕분에 기존 사용자는 튕기지 않는다.
  대신 그 사이 신규 가입자는 닉네임 화면을 보지 못한다.
- 탈퇴와 재가입
  - `restore_deleted_account`는 `deleted_at`만 되돌리므로 `onboarded_at`이 유지된다.
  - 30일 뒤 배치는 행을 완전히 삭제하므로, 재가입하면 새 행(null)이 생겨 닉네임 화면을 본다.

### 5.2 판정 — 한 함수로

```ts
// services/auth/profileService.ts
/**
 * 옛 캐시 프로필에는 onboarded_at 키가 없다(undefined). 이를 미완료로 보면 업데이트 직후 기존 사용자 전원이
 * 닉네임 화면으로 튕기므로, 서버가 준 null만 미완료로 본다. 프로필 자체가 없으면 기존처럼 설정 화면으로 보낸다.
 */
export const needsOnboarding = (profile: Profile | null) =>
  !profile || profile.onboarded_at === null;
```

- `!profile`을 넣은 이유: 이게 없으면 프로필 생성에 실패한 사용자가 프로필도 가계부도 없이 홈으로 간다(리뷰 차단 1).
  기존 `!profile?.full_name`과 같은 동작이다. 캐시는 항상 키만 빠진 객체라 옛 캐시 보호는 그대로 된다.
- 판정이 흩어진 곳을 이 함수로 바꾼다: `AuthContext`의 `!profile?.full_name` 4곳, `isProfileComplete`, `checkProfileAndRoute`.
- `needsProfile`은 `AuthState`(`packages/types`)에서 빼고, `AuthContextValue`에서 `needsOnboarding(profile)`로 계산한다.
  index·login·invite 코드는 바뀌지 않는다. web은 사용처가 없다.
- 타입: `Profile.onboarded_at?: string | null`. optional로 둬서 옛 캐시에 undefined가 올 수 있다는 점을 드러낸다.

### 5.3 기본 가계부 이름 변경

```ts
// 순수 함수. 안내 줄과 저장이 같은 결과를 쓴다.
export const findDefaultLedger = (ledgers, userId, currentName) =>
  ledgers.find((l) => l.created_by === userId && l.name === `${currentName}의 가계부`);
```

- 화면이 `useLedger().ledgers`(내가 멤버인 가계부)에서 찾은 **가계부 하나의 id**로 `ledgerService.updateLedger({ ledgerId, name })`를 부른다.
  - 조건이 한 곳에만 있어서 "안내가 보였는데 안 바뀜"이 생기지 않는다.
  - core의 권한 검사와 `LedgerRules.validateName`(최대 50자)을 거친다.
  - 소유권을 넘기고 나간 가계부는 목록에 없으므로 제외된다. `created_by`는 소유권을 넘겨도 바뀌지 않는다.
- 실측(09-24): 조건에 걸리는 17개가 전부 각자의 첫 가계부다. 2개 이상 걸리는 사용자는 0명이다.
- 실패해도 가입은 계속 진행한다(`console.warn`). 사용자가 가계부 설정에서 직접 바꿀 수 있다.
- 공유 중인 기본 가계부는 상대방에게도 바뀐 이름으로 보인다. 의도한 동작이다.
- 가계부 목록이 아직 로드되지 않았으면 안내 줄도 변경도 없다. 신규 가입 직후라면 목록이 거의 즉시 오므로 받아들인다.

### 5.4 애플 이름 전달 (원인 1 수정)

```ts
// authService.handleAppleSignIn
const fullName = formatAppleFullName(credential.fullName); // 빈 값이면 undefined
rememberSignupName(fullName);
try {
  await supabase.auth.signInWithIdToken(...); // 리스너가 이 안에서 보관된 이름으로 프로필 생성
} finally {
  rememberSignupName(undefined); // 실패·취소·기존 계정이어도 남지 않는다
}
```

- 로그인 뒤에 저장하는 방식은 닉네임 화면이 먼저 마운트될 수 있어서 여전히 경쟁 상태가 생긴다.
  미리 넘겨 두면 새 가입자의 기본 가계부도 처음부터 제 이름으로 만들어진다.
- `finally`에서 비우는 이유: 로그인이 실패했거나, 기존 계정이라 프로필을 새로 만들지 않았거나, 애플 연결을 끊고 다시
  로그인해서 이름을 또 받았을 때 이름이 모듈에 남는다. 그러면 같은 세션에서 다른 계정으로 가입할 때 그 이름이 붙는다.
- `formatAppleFullName`(순수 함수)
  - 성과 이름이 모두 한글이면 `성이름`(홍길동), 아니면 `이름 성`.
  - 둘 다 비었으면 `undefined`. 애플은 재로그인 때 값이 전부 null인 객체를 준다. 지금 코드는 이때 `''`를 만들고,
    `COALESCE`를 통과해 이름이 `''`, 가계부가 `의 가계부`가 된다.
- `toNicknameDraft(name)`(순수 함수, 기본값 정리)
  - 순서: 악센트 제거(NFD → 결합 문자 제거 → NFC, 한글은 다시 조합됨) → 허용하지 않는 문자 제거 → 공백 하나로 합치기 → 20자로 자르기.
  - 결과가 규칙에 맞지 않거나 이메일 앞부분이면 빈칸.
  - 예: `Gil-dong Hong`→`Gildong Hong`, `O'Brien`→`OBrien`, `José García`→`Jose Garcia`, `홍`(1자)→빈칸, `山田太郎`→빈칸.

### 5.5 화면 이동과 중복 정리

- `authService.checkProfileAndRoute`를 없앤다.
  - 지금은 이 함수의 `router.replace`와 login.tsx effect가 **이중으로** 이동한다. 닉네임 화면이 다시 마운트되면 입력값이 초기화될 수 있다.
  - 로그인 뒤 핸들러가 부르는 두 번째 `ensureProfile`(`authService.ts:86`, `175`)과 `AuthResult.needsProfile`도 같이 지운다.
    프로필 생성 지점은 리스너 하나가 된다.
- 이동은 로그인 전후 index.tsx·login.tsx·invite.tsx, 설정 완료 후 닉네임 화면의 effect에서 모두 `needsProfile`로 판단한다.
- invite.tsx는 로그인한 상태에서 닉네임 화면으로 보낼 때 `code`를 파라미터로 넘긴다. 저장소가 필요 없어
  BGI-22의 경량 원칙과 충돌하지 않는다.
- `isSettingSession` ref는 true로 바뀌는 곳이 없는 죽은 코드다. 지운다.

### 5.6 `updateProfile`

- 지금은 에러를 잡아 알림만 띄우고 **다시 던지지 않는다.** 그래서 호출하는 쪽의 `catch`가 동작하지 않고,
  기존 설정 화면은 저장에 실패해도 홈으로 넘어간다.
  - 바꾼 뒤: 알림 없이 에러를 던진다. 호출처는 두 곳(프로필 설정, 닉네임 화면)이고, 각자의 `catch`에서 알림을 띄운다.
    프로필 설정에는 이미 알림 코드가 있다(`profile-settings.tsx:86`).
- 지금은 저장한 뒤 `fetchProfile`로 다시 조회하고, 이 조회가 실패하면 상태에 `profile: null`이 들어간다.
  - 바꾼 뒤: `.update().select().single()`이 돌려준 행으로 상태와 캐시를 갱신한다. 행이 없으면 에러로 처리한다.

### 5.7 받아들인 위험

- **콜드 스타트 직후 너무 빨리 저장하는 경우.** 캐시로 화면이 뜨자마자(수백 ms 안에) 저장하면, 저장 전에 시작된
  프로필 동기화가 늦게 도착해 상태를 `onboarded_at: null`로 되돌릴 수 있다. 결과는 다음 실행에 화면이 한 번 더 뜨는 것이고,
  기본값이 채워져 있어 한 번 누르면 끝난다. 막으려면 조회에 순번을 매겨야 하는데, 그 비용이 더 크다고 봤다.
- **기존 13명 중 프로필 설정에서 먼저 닉네임을 바꾼 사람.** 다음 실행에 화면이 뜨지만, 바꾼 이름이 기본값으로 채워져 있다(한 번 탭).
  프로필 설정이 `onboarded_at`까지 채우게 하면 두 경로가 얽히므로 하지 않는다.

## 6. 작업 순서 — 단계마다 앱이 동작하고 tsc가 통과한다

| # | 커밋 | 내용 | 파일 |
|---|---|---|---|
| 1 | tidy | `isSettingSession` 제거 | `contexts/AuthContext.tsx` |
| 2 | tidy | `checkProfileAndRoute`·핸들러의 두 번째 `ensureProfile`·`AuthResult.needsProfile` 제거. `updateProfile`이 에러를 던지고 저장된 행을 쓰게 변경. 기존 설정 화면에 `catch` 알림 추가 | `services/auth/authService.ts`, `contexts/AuthContext.tsx`, `app/(auth)/profile-setup.tsx` |
| 3 | feat | 마이그레이션과 seed(김철수·이영희는 `onboarded_at` 명시, `new@test.com`은 `p_full_name` NULL), 타입(`auth.ts`, `database-generated.ts`의 profiles 항목만 수정), `needsOnboarding`으로 판정 교체, `needsProfile` 계산화, 기존 설정 화면이 `onboarded_at`도 저장, dev "신규" 로그인 버튼 | `supabase/…`, `packages/types/…`, `services/auth/profileService.ts`, `contexts/AuthContext.tsx`, `app/(auth)/*.tsx` |
| 4 | feat | 닉네임 화면 재작성(§4). `toNicknameDraft`, invite `code` 전달 | `app/(auth)/profile-setup.tsx`, `app/invite.tsx`, `services/auth/profileService.ts` |
| 5 | feat | 기본 가계부 이름 변경과 안내 줄(`findDefaultLedger`) | `app/(auth)/profile-setup.tsx`, `services/auth/profileService.ts` |
| 6 | fix | 애플 이름 전달, `formatAppleFullName` | `services/auth/authService.ts`, `services/auth/profileService.ts` |
| 7 | docs | 아키텍처 문서(가입 플로우, useAuth) | `docs/architecture.md` |

- 4·5는 화면 한 파일을 두 번 고치게 돼 한 커밋(`eba2b1c`)으로 합쳤다.
- 테스트 인프라(jest/vitest)는 없고, 이번에 추가하지 않는다. 대신 판정과 정리 규칙을 의존성 없는 순수 함수로 둔다
  (`needsOnboarding`, `formatAppleFullName`, `toNicknameDraft`, `findDefaultLedger`). 나중에 테스트를 붙이기 쉽게 하기 위해서다.
- 생성 타입 재생성 명령(`npx supabase gen types typescript --local`)은 문서에만 남기고, 재생성은 별도 작업으로 한다.

## 7. 검증

> 2026-09-24 시뮬레이터에서 확인한 항목은 [x]로 표시했다. 애플·구글 로그인은 시뮬레이터에서 안 되므로 실기기 항목으로 남는다.

**로컬 DB**
- [x] `db reset` 뒤 김철수·이영희는 `onboarded_at`이 있고, `new@test.com`은 null이며 이름 `new`, 가계부 `new의 가계부`다
- [x] 백필 SQL: `db reset`은 마이그레이션을 seed보다 먼저 돌려서 백필을 검증하지 못한다. 실제로는 기존 DB에서 트랜잭션 안에 앞부분 이름·빈 이름 사용자를 넣고 마이그레이션을 실행한 뒤 롤백해 확인했다(앞부분·빈 이름만 null). 아래는 대안 절차다.
  1. `npx supabase db reset --version 20260830000013`
  2. 이메일 앞부분 이름 사용자를 넣는다
  3. `npx supabase migration up --local`

**시뮬레이터 (dev 로그인)**
- [x] 신규: 닉네임 화면이 뜨고 기본값은 빈칸이다. 입력하면 안내 줄이 보이고, 저장하면 홈 상단과 가계부 선택 목록에 새 이름이 뜬다
- [x] 신규 저장 후 콜드 스타트: 화면이 뜨지 않는다
- [x] 김철수: 화면이 뜨지 않는다
- [x] 옛 캐시: AsyncStorage 캐시에서 `onboarded_at` 키를 빼고 콜드 스타트해도 화면이 뜨지 않는다
- [x] 백필 대상 재현(DB null + 캐시에 키 없음): 첫 실행은 홈, 두 번째 실행부터 닉네임 화면
- [x] "다른 계정으로 로그인": 로그인 화면으로 돌아간다
- [x] 캐시는 null인데 서버는 완료인 경우: 화면이 잠깐 떴다가 홈으로 넘어간다
- [x] 저장 실패(로컬에서 profiles UPDATE 권한을 잠시 회수해 재현): 화면에 남고 알림은 한 번만 뜬다
- [ ] 닉네임 화면이 한 번만 마운트된다(이중 이동 없음)
- [x] 한글 입력 중 오류가 깜빡이지 않는다. 규칙 위반 입력은 누르면 오류가 뜬다
- [ ] 프로필 설정 닉네임 수정: 가계부 이름은 그대로이고, 실패하면 알림이 한 번만 뜬다
- [x] 로그인한 상태에서 `bugie://invite?code=…`로 연 미완료 사용자: 닉네임 → 초대 수락 화면

**실기기**
- [ ] 새 애플 가입: 이름이 기본값으로 채워지고 가계부 이름이 맞다
  (설정 › Apple ID › 애플로 로그인에서 연결을 끊고, dev-account-deletion 절차를 거친다)
- [ ] 애플 재로그인(이름 없음): `''` 이름이 저장되지 않는다
- [ ] 애플 로그인을 취소한 직후 구글로 신규 가입해도 애플 이름이 붙지 않는다
- [ ] 구글 신규 가입: 기본값이 구글 이름이고, 닉네임을 바꿀 때만 안내 줄이 보인다

## 8. 배포

1. 프로덕션 `npx supabase db push --dry-run`으로 확인한 뒤 push한다. 같은 조건으로 미리 세어 보니(09-24) 전체 40명 중
   27명이 완료 처리되고 13명이 null로 남는다.
2. 앱 출시(BGI-20·33과 함께 1.5.0). App Store 심사 노트에 닉네임 화면의 목적을 적는다(§9).

## 9. 리뷰에서 나온 사용자 결정 사항 (09-24, 모두 적용)

- [x] **문구는 "이름" 대신 "닉네임"을 쓴다.** Sign in with Apple 뒤에 "이미 받은 이름을 다시 묻는다"는 이유로 반려된 사례가 보고돼 있다.
  앱 안에서만 쓰는 표시 이름이라는 점과 나중에 바꿀 수 있다는 점을 화면에 밝힌다.
- [x] **"다른 계정으로 로그인" 링크를 둔다.** 잘못된 계정으로 가입했을 때 빠져나갈 길이다. 건너뛰기는 두지 않는다.
- [x] **기본값이 빈칸이면 지금 이름을 보여준다.** 예: "지금은 vtnh59jpv9로 보이고 있어요". 기존 13명이 왜 이 화면을 보는지 알 수 있게 한다.
