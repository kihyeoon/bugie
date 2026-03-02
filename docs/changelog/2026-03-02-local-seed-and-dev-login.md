# 로컬 개발용 Seed 데이터 및 개발 로그인

작성일: 2026-03-02

## 배경

`npx supabase db reset` 실행 시 모든 로컬 데이터가 삭제된다. 매번 수동으로 테스트 데이터를 넣는 불편함을 해소하고, 개발 환경에서 빠르게 로그인할 수 있도록 seed 파일과 개발용 로그인 기능을 추가했다.

## 변경 파일

| 파일 | 변경 내용 |
|------|-----------|
| `supabase/seed.sql` | 테스트 유저, 가계부, 거래 데이터 자동 생성 |
| `apps/native/app/(auth)/login.tsx` | 개발 환경 전용 테스트 로그인 버튼 |
| `.env.local` | JWT 기반 anon key로 교체 |

## Part 1: seed.sql

### 데이터 구성

| 항목 | 내용 |
|------|------|
| 유저 2명 | 김철수 `husband@test.com` / 이영희 `wife@test.com` |
| 비밀번호 | 모두 `password123` |
| 개인 가계부 | `create_user_profile()` RPC로 자동 생성 (각 1개) |
| 공유 가계부 | "우리집 가계부" (김철수=owner, 이영희=member) |
| 샘플 거래 | 공유 가계부에 지출 4건 + 수입 2건, `paid_by` 활용 |

### auth.users 직접 INSERT 시 주의사항

GoTrue(인증 서비스)가 `auth.users` 행을 읽을 때, 토큰 관련 컬럼이 NULL이면 에러가 발생한다:

```
sql: Scan error on column index 3, name "confirmation_token": converting NULL to string is unsupported
```

**해결**: 토큰 컬럼들을 빈 문자열(`''`)로 명시적 설정.

```sql
confirmation_token, recovery_token,
email_change_token_new, email_change_token_current,
email_change, phone_change,
phone_change_token, reauthentication_token
-- 모두 '' (빈 문자열)로 설정
```

`phone` 컬럼은 unique 제약이 있으므로 INSERT에서 제외 (NULL 허용).

### 거래 날짜

`CURRENT_DATE - INTERVAL 'N days'`로 상대 날짜 사용. 리셋 시점에 관계없이 항상 최근 데이터로 생성된다.

## Part 2: 개발용 로그인 버튼

### 동작 방식

- `__DEV__` 전역 변수로 개발 환경 판별 (프로덕션 빌드에서 자동 제외)
- `supabase.auth.signInWithPassword()`로 이메일/패스워드 로그인
- 로그인 성공 시 `useEffect`에서 `router.replace()`로 홈 화면 이동

### 왜 명시적 라우팅이 필요한가

OAuth 로그인은 브라우저 → 딥링크로 앱이 재진입하면서 `index.tsx`의 리다이렉트를 거친다. 하지만 패스워드 로그인은 같은 화면에 머물러 있어서 `onAuthStateChange`가 상태를 갱신해도 네비게이션이 트리거되지 않는다. 이를 위해 `login.tsx`에 인증 상태 감지 `useEffect`를 추가했다.

## Part 3: .env.local 키 형식

Supabase CLI의 새 버전은 `sb_publishable_...` 형식의 키를 발급하지만, `@supabase/supabase-js` 클라이언트는 JWT 기반 anon key가 필요하다.

```bash
# 올바른 키 확인
npx supabase status -o env | grep ANON_KEY
```

## 로컬 개발 명령어 정리

```bash
# 전체 초기화 (스키마 + seed)
npx supabase db reset

# 새 마이그레이션만 적용 (데이터 유지)
npx supabase migration up

# 프로덕션에 마이그레이션 배포
npx supabase db push
```
