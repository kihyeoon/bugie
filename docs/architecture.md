# 아키텍처

Bugie 모노레포의 구조, 계층, 그리고 native 앱의 핵심 패턴을 정리한 문서.

## 모노레포 구조

```
apps/
  native/          # Expo SDK 53 + Expo Router (React Native 0.79)
  web/             # Next.js 15 + Tailwind CSS v4
packages/
  core/            # 비즈니스 로직 (클린 아키텍처) — TS source 직접 참조
  types/           # DB 타입, Supabase generated types — TS source 직접 참조
  ui/              # 공유 UI 컴포넌트 — tsup 빌드 필요 (dist/)
  typescript-config/ # 공유 tsconfig (base, nextjs, react-native-library)
supabase/
  migrations/      # PostgreSQL 마이그레이션 (날짜순 정렬)
```

`@repo/core`와 `@repo/types`는 `main: "./src/index.ts"`로 소스를 그대로 참조한다. 따라서 빌드가 필요 없고, 변경하면 즉시 native/web에 반영된다. **`@repo/ui`만 `tsup` 빌드 산출물(`dist/`)을 참조**하므로 수정 후 `pnpm --filter @repo/ui build`를 돌려야 한다.

## `@repo/core` — 클린 아키텍처 3계층

```
packages/core/src/
  domain/            # 순수 비즈니스 규칙 (의존성 없음)
    shared/          # 공통 타입, 에러, 유틸 (formatLocalDate 포함)
    ledger/          # 가계부 도메인 (rules, types)
    transaction/     # 거래 도메인
    profile/         # 프로필 도메인
    auth/            # 인증 타입
  application/       # 유스케이스 (서비스 클래스)
    ledger/          # LedgerService
    transaction/     # TransactionService
    profile/         # ProfileService
    permission/      # PermissionService
  infrastructure/    # 외부 시스템 구현체
    supabase/
      repositories/  # Supabase CRUD 구현
      mappers/       # DB row ↔ 도메인 객체 변환
      auth/          # SupabaseAuthService
      profile/       # SupabaseProfileRepository
  shared/            # UI/응답 전용 타입 (CalendarData 등)
```

### 서비스 인스턴스 생성

팩토리 함수로 DI를 구성한다. 직접 `new TransactionService(...)`를 호출하지 말 것.

```ts
createLedgerService(supabase)
createTransactionService(supabase)
createProfileService(supabase)
```

## Native 앱 — Provider 체인

`_layout.tsx`의 Provider 순서가 중요하다 (의존 방향 위→아래):

```
GestureHandlerRootView
  → AuthProvider        (인증 상태)
    → ServiceProvider   (core 서비스 인스턴스)
      → LedgerProvider  (현재 선택된 가계부)
        → ThemeProvider
```

## Native 앱 — 라우팅 구조

```
app/
  index.tsx              # 진입점: 인증 상태에 따라 리다이렉트
  _layout.tsx            # Root Layout (Provider 체인)
  (auth)/                # 인증 그룹
    login.tsx            # 소셜 로그인 (Google, Apple)
    profile-setup.tsx    # 최초 프로필 설정
  (tabs)/                # 탭 네비게이션 그룹
    index.tsx            # 홈 (월간 캘린더)
    add.tsx              # 빠른 입력 (커스텀 키패드)
    more.tsx             # 더보기 메뉴
  transactions.tsx       # 거래 목록 (스택)
  transaction-detail.tsx # 거래 상세/수정 (스택)
  ledger-management.tsx  # 가계부 관리 (스택)
  ledger-settings.tsx    # 가계부 설정 (스택)
  profile-settings.tsx   # 프로필 설정 (스택)
```

## Native 앱 — 주요 hook & 컨텍스트

| 목적 | 진입점 | 반환 |
|------|--------|------|
| core 서비스 | `useServices()` | `{ ledgerService, transactionService, profileService }` |
| 인증 상태 | `useAuth()` | `{ user, session, loading, needsProfile }` |
| 현재 가계부 | `useLedger()` | `{ currentLedger, ledgers, selectLedger, refreshLedgers }` |
| 데이터 fetch | `useMonthlyData`, `useTransactions`, `useTransactionDetail`, `useCategories` | 각 hook 시그니처 참조 |

데이터 hook은 글로벌 캐시 없이 `useState`만 사용한다. 첫 진입 LoadingState 노출은 의도된 동작.

## Native 앱 — 컴포넌트 계층

- `components/ui/` — 범용 UI (Button, Card, Typography, AmountInput, ToggleSwitch 등)
- `components/shared/` — 도메인 공유 컴포넌트 (Calendar, CategorySelector, EditTextModal, ScreenHeader 등)
- `components/{domain}/` — 도메인 전용 (`ledger/`, `transaction/`, `profile/`, `auth/`)

## TypeScript 설정

| tsconfig | 용도 |
|----------|------|
| `@repo/typescript-config/base.json` | 공통 기본 |
| `@repo/typescript-config/nextjs.json` | Next.js 웹용 |
| `@repo/typescript-config/react-native-library.json` | RN 앱/라이브러리용 |
