# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

**Bugie**는 공유 가계부 앱으로, React Native Web 기반 모노레포 구조로 웹과 네이티브 플랫폼에서 동일한 경험을 제공합니다.

### 핵심 기능

**1. 공유 가계부**

- 하나의 가계부에 다수의 사용자가 동시 접근
- 역할 권한 구분: 소유자·편집자·조회자
- 실시간 동기화: 사용자 입력·편집 시 3초 이내 반영

**2. 수입·지출 관리**

- 수동 입력: 항목, 금액, 카테고리, 결제수단, 메모
- 자동 분류: 카테고리 추천 정확도 80% 이상
- 빠른 입력: 음성 입력, 카메라 영수증 스캔, 원터치 자주 사용 항목 추천

**3. 예산 관리**

- 월/주 카테고리별 예산 설정
- 예산 사용률 80%, 100% 돌파 시 푸시 알림

**4. 사용자 경험**

- 직관적 인터페이스: 카테고리별 아이콘과 색상 구분
- 개인화된 대시보드: 월간/주간 지출 현황, 개인/공동 지출 구분
- 목표 대비 지출률 시각화

### 기술 스택

**프론트엔드**

- **web**: Next.js 15
- **native**: Expo SDK 53 + Expo Router 앱 + Web View
- **@repo/ui**: 공유 UI 컴포넌트 라이브러리
- **@repo/typescript-config**: 공유 TypeScript 설정
- **스타일링**: Tailwind CSS(Web), React Native StyleSheet(Native)

**백엔드 & 인프라**

- **데이터베이스**: Supabase PostgreSQL
- **인증**: Supabase Auth (소셜 로그인, 이메일/비밀번호)
- **실시간 동기화**: Supabase Realtime

## 추가 지침

- @docs/spec-workflow.md - 스펙 기반 개발 워크플로우('스펙 기반으로 개발' 요청 시 사용)
- @docs/prd.md - 제품 요구사항 문서
- @docs/mvp-plan.md - MVP 개발 계획 및 일정
- @docs/screen-design.md - 화면별 상세 설계 문서
- @docs/database.md - 데이터베이스 스키마 설계
- @docs/design-principles.md - 디자인 원칙

## 주요 명령어

### 개발 서버 실행

```bash
# 모든 앱 동시 실행
pnpm dev

# 개별 앱 실행
cd apps/web && pnpm dev          # Next.js 웹 앱 (localhost:3000)
cd apps/native && pnpm start     # Expo 앱 (localhost:8081)
```

### 빌드

```bash
# 전체 빌드 (의존성 순서 자동 관리)
pnpm build

# 개별 빌드
cd apps/web && pnpm build        # Next.js 프로덕션 빌드
cd packages/ui && pnpm build     # UI 컴포넌트 라이브러리 빌드
```

### 테스트 및 검사

```bash
pnpm lint                        # 전체 프로젝트 lint
cd apps/web && pnpm lint         # 웹 앱만 lint
cd apps/native && pnpm lint      # 네이티브 앱만 lint
```

### 패키지 관리

```bash
# 새 의존성 설치
pnpm add <package> --filter web    # 웹 앱에만 설치
pnpm add <package> --filter native # 네이티브 앱에만 설치

# workspace 의존성 업데이트
pnpm install                       # 모든 workspace 의존성 설치
```

## 아키텍처 구조

### TypeScript 설정 계층

- `@repo/typescript-config/base.json`: 공통 기본 설정
- `@repo/typescript-config/nextjs.json`: Next.js 웹 앱용
- `@repo/typescript-config/react-native-library.json`: React Native 앱/라이브러리용

### Metro 설정 (Native)

모노레포 지원을 위해 커스터마이징됨:

- `watchFolders`: 루트 디렉토리 감시하여 공유 패키지 변경 감지
- `nodeModulesPaths`: 로컬과 루트 node_modules 모두 탐색
- 공유 패키지 Hot Reload 지원

## 개발 시 주의사항

### Supabase 연동

- 환경변수에 Supabase URL과 anon key 설정
- 실시간 구독은 useEffect cleanup 필수
- Row Level Security(RLS) 정책으로 데이터 보안
- 가계부 공유 기능은 Supabase의 다중 사용자 정책 활용

### 의존성 설치 규칙

- 웹 전용 패키지는 `apps/web`에만 설치
- 네이티브 전용 패키지는 `apps/native`에만 설치
- 공통 dev 도구는 루트 package.json에 설치

### Expo Router 구조 (Native)

- `app/(tabs)/`: 탭 네비게이션 그룹
- `app/+not-found.tsx`: 404 페이지
- `@/` alias는 앱 루트를 가리킴
- 파일 기반 라우팅 사용

### React Native 컴포넌트 사용 규칙

- 터치 인터랙션에는 `TouchableOpacity` 대신 `Pressable` 사용
  - 더 나은 성능과 유연한 press state 처리
  - Ripple 효과 및 press 상태 스타일링 지원
