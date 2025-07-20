# Bugie - 공유 가계부 앱

Bugie는 부부가 함께 사용할 수 있는 실시간 공유 가계부 앱입니다. React Native Web 기반 모노레포 구조로 웹과 네이티브 플랫폼에서 동일한 경험을 제공합니다.

## 🚀 주요 기능

- 🔐 **소셜 로그인**: Google, Apple, Kakao 계정으로 간편 로그인
- 👥 **실시간 공유**: 가계부를 여러 사용자가 동시에 사용
- 💰 **수입/지출 관리**: 직관적인 거래 입력 및 분류
- 📊 **예산 관리**: 월별/카테고리별 예산 설정 및 추적
- 🔄 **실시간 동기화**: 3초 이내 모든 변경사항 반영

## 🏗️ 프로젝트 구조

이 프로젝트는 Turborepo를 사용한 모노레포 구조입니다:

### Apps and Packages

- `apps/native`: [Expo](https://docs.expo.dev/) 기반 React Native 앱
- `apps/web`: [Next.js](https://nextjs.org/) 웹 애플리케이션
- `packages/ui`: 공통 UI 컴포넌트 라이브러리
- `packages/types`: TypeScript 타입 정의
- `packages/typescript-config`: 공유 TypeScript 설정

### 기술 스택

- **Frontend**: Next.js 15, Expo SDK 53, React Native
- **Backend**: Supabase (PostgreSQL, Auth, Realtime)
- **Styling**: Tailwind CSS (Web), React Native StyleSheet (Native)
- **Type Safety**: TypeScript
- **Build System**: Turborepo
