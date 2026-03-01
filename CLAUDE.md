# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

**Bugie**는 부부/가족을 위한 공유 가계부 앱. pnpm + Turborepo 모노레포 구조로 웹(Next.js)과 네이티브(Expo)를 동시 지원한다.

## 주요 명령어

```bash
# 개발
pnpm dev                              # 전체 앱 동시 실행 (turbo)
pnpm --filter native start            # Expo 앱만 (localhost:8081)
pnpm --filter web dev                 # Next.js 웹만 (localhost:3000)
pnpm ios                              # iOS 시뮬레이터 실행

# 빌드
pnpm build                            # 전체 빌드 (의존성 순서 자동)
pnpm --filter web build               # Next.js 프로덕션 빌드
pnpm --filter @repo/ui build          # UI 패키지 빌드 (tsup)

# 검사
pnpm lint                             # 전체 lint
pnpm --filter native lint             # 네이티브만 lint (expo lint)
pnpm --filter web lint                # 웹만 lint (next lint)
pnpm --filter @repo/core lint         # core 패키지 lint + tsc --noEmit
pnpm format                           # prettier 전체 포맷팅
pnpm check                            # lint + format --check

# 패키지 설치
pnpm add <pkg> --filter native        # 네이티브 앱 전용
pnpm add <pkg> --filter web           # 웹 앱 전용
pnpm add <pkg> -w                     # 루트 (공통 dev 도구)
```

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

**주의**: `@repo/core`와 `@repo/types`는 `main: "./src/index.ts"`로 소스 직접 참조. `@repo/ui`만 빌드(`pnpm --filter @repo/ui build`) 필요.

## 아키텍처

### @repo/core — 클린 아키텍처 3계층

```
packages/core/src/
  domain/            # 순수 비즈니스 규칙 (의존성 없음)
    shared/          # 공통 타입, 에러, 유틸
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

**서비스 생성**: 팩토리 함수로 DI 구성. `createLedgerService(supabase)`, `createTransactionService(supabase)`, `createProfileService(supabase)`.

### Native 앱 — Context Provider 체인

`_layout.tsx`의 Provider 순서가 중요:

```
GestureHandlerRootView
  → AuthProvider        (인증 상태)
    → ServiceProvider   (core 서비스 인스턴스)
      → LedgerProvider  (현재 선택된 가계부)
        → ThemeProvider
```

### Native 앱 — 라우팅 구조

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

### Native 앱 — 주요 패턴

- **서비스 접근**: `useServices()` hook → `{ ledgerService, transactionService, profileService }`
- **인증 상태**: `useAuth()` → `{ user, session, loading, needsProfile }`
- **가계부 상태**: `useLedger()` → `{ currentLedger, ledgers, selectLedger, refreshLedgers }`
- **데이터 hooks**: `useMonthlyData`, `useTransactions`, `useTransactionDetail`, `useCategories`
- **컴포넌트 구성**:
  - `components/ui/` — 범용 UI (Button, Card, Typography, AmountInput, ToggleSwitch 등)
  - `components/shared/` — 도메인 공유 컴포넌트 (Calendar, CategorySelector, EditTextModal 등)
  - `components/{domain}/` — 도메인 전용 (ledger/, transaction/, profile/, auth/)

## 환경변수

Web과 Native에서 접두사가 다름:

| 용도 | Web (Next.js) | Native (Expo) |
|------|--------------|---------------|
| Supabase URL | `NEXT_PUBLIC_SUPABASE_URL` | `EXPO_PUBLIC_SUPABASE_URL` |
| Supabase Anon Key | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `EXPO_PUBLIC_SUPABASE_ANON_KEY` |
| Service Role Key | `SUPABASE_SERVICE_ROLE_KEY` | — |

## 개발 시 주의사항

### Supabase

- RLS(Row Level Security) 정책이 모든 테이블에 적용됨 — 새 테이블 추가 시 반드시 RLS 설정
- Soft Delete 패턴 사용 (`deleted_at` 컬럼) — 삭제는 SECURITY DEFINER 함수로 처리
- 회원 탈퇴: soft delete 후 30일 유예 → GitHub Actions cron(`process-account-deletions.yml`)으로 완전 삭제
- 마이그레이션 파일은 `supabase/migrations/` 아래 날짜순 정렬
- 실시간 구독 사용 시 useEffect cleanup 필수

### 의존성 설치 규칙

- 웹 전용 → `apps/web`, 네이티브 전용 → `apps/native`, 공통 dev 도구 → 루트
- `@repo/core`에 새 의존성 추가 시 web/native 양쪽에서 사용 가능한지 확인

### React Native 규칙

- 터치 인터랙션은 `TouchableOpacity` 대신 `Pressable` 사용
- `@/` alias는 네이티브 앱 루트를 가리킴
- 색상은 반드시 `constants/Colors.ts`의 시맨틱 컬러 사용 (Toss 디자인 시스템 기반)
- 네이티브 앱에서 `@repo/core` 서비스는 `useServices()` hook으로 접근

### TypeScript 설정

- `@repo/typescript-config/base.json` — 공통 기본
- `@repo/typescript-config/nextjs.json` — Next.js 웹용
- `@repo/typescript-config/react-native-library.json` — RN 앱/라이브러리용

## 추가 지침

- `docs/spec-workflow.md` — 스펙 기반 개발 워크플로우 ('스펙 기반으로 개발' 요청 시 사용)
- `docs/prd.md` — 제품 요구사항 문서
- `docs/mvp-plan.md` — MVP 개발 계획 및 진행 상황
- `docs/screen-design.md` — 화면별 상세 설계 문서
- `docs/design-principles.md` — 디자인 원칙 (색상, 타이포그래피, 간격 체계)
