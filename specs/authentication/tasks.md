# 인증 시스템 구현 작업 목록

## 개요
네이티브 앱에서만 인증을 구현하고, 웹뷰에는 세션을 전달하는 구조로 개발합니다.

## 진행 상황
- ✅ Week 1: 백엔드 및 기초 설정 (완료)
  - ✅ Supabase OAuth 설정 (Google 완료, Apple/Kakao 대기)
  - ✅ 데이터베이스 구성
  - ✅ 타입 정의
  - ✅ 클라이언트 설정
- 🔄 Week 2: 프론트엔드 구현 (진행중)
  - ✅ AuthContext 구현
  - ⏳ 로그인 화면
  - ⏳ 프로필 설정 화면
  - ⏳ 보호된 라우트
  - ⏳ OAuth 콜백 처리

## Week 1: 백엔드 및 기초 설정

### 1. Supabase 프로젝트 설정 및 OAuth 구성 ✅
**파일**: 없음 (Supabase 대시보드 작업)
**작업 내용**:
- [x] Supabase 프로젝트에서 Authentication 설정 활성화
- [x] Google OAuth 앱 생성 및 Client ID/Secret 설정
- [ ] Apple OAuth 설정 (Apple Developer 계정 필요)
- [ ] Kakao OAuth 앱 생성 및 설정
- [x] 리다이렉트 URL 구성:
  - 웹: `https://{project-ref}.supabase.co/auth/v1/callback`
  - 네이티브: `bugie://auth/callback`
- [x] 환경변수 파일 업데이트 (심볼릭 링크로 루트 .env.local 사용)

### 2. 데이터베이스 마이그레이션 작성 ✅
**파일**: `supabase/migrations/001_create_profiles_table.sql`
**작업 내용**:
- [x] profiles 테이블 생성 SQL 작성
- [x] RLS 정책 추가
- [x] handle_new_user() 함수 생성
- [x] 트리거 설정
- [x] 마이그레이션 실행 및 테스트

### 3. 공통 타입 패키지 생성 ✅
**파일**: 
- `packages/types/package.json` (기존 파일 사용)
- `packages/types/tsconfig.json` (기존 파일 사용)
- `packages/types/src/index.ts` (수정)
- `packages/types/src/auth.ts` (수정)

**작업 내용**:
- [x] @repo/types 패키지 초기화 (이미 존재)
- [x] TypeScript 설정
- [x] auth.ts에 User, Profile, Session, AuthState 타입 정의
- [x] index.ts에서 export (중복 방지를 위해 export type 사용)
- [x] 빌드 스크립트 설정

### 4. Supabase 클라이언트 구성 ✅
**파일**:
- `apps/native/utils/supabase.ts` (수정)
- `apps/native/utils/webviewBridge.ts` (생성)

**작업 내용**:
- [x] 네이티브용 클라이언트 설정 (SecureStore 사용)
- [x] OAuth 리다이렉트 URL 헬퍼 함수 추가
- [x] 웹뷰 브릿지 헬퍼 함수 작성
- [x] 타입 안전성 확보

## Week 2: 프론트엔드 구현

### 5. AuthContext 구현 ✅
**파일**:
- `apps/native/contexts/AuthContext.tsx` (생성)
- `apps/native/hooks/useAuth.ts` (생성)

**작업 내용**:
- [x] AuthContext Provider 컴포넌트 생성
- [x] 인증 상태 관리 로직
- [x] 세션 자동 갱신 설정
- [x] signInWithOAuth 함수 구현
- [x] signOut 함수 구현
- [x] updateProfile 함수 구현
- [x] useAuth 훅 생성

### 6. 로그인 화면 구현
**파일**:
- `apps/native/app/(auth)/login.tsx`
- `apps/native/app/(auth)/_layout.tsx`
- `apps/native/components/auth/SocialLoginButton.tsx`

**작업 내용**:
- [ ] 네이티브 로그인 스크린 레이아웃
- [ ] SocialLoginButton 컴포넌트
- [ ] 로딩 상태 처리
- [ ] 에러 메시지 표시
- [ ] 브랜드 로고 및 스타일링

### 7. 프로필 설정 화면 구현
**파일**:
- `apps/native/app/(auth)/profile-setup.tsx`
- `apps/native/components/auth/ProfileForm.tsx`

**작업 내용**:
- [ ] 프로필 폼 컴포넌트 개발
- [ ] 닉네임 입력 필드 (2-20자 유효성 검사)
- [ ] 프로필 사진 표시 및 변경 옵션
- [ ] 통화 선택 드롭다운
- [ ] 약관 동의 체크박스
- [ ] 폼 제출 및 API 호출
- [ ] 완료 후 홈 화면 리다이렉트

### 8. 보호된 라우트 구현
**파일**:
- `apps/native/app/(tabs)/_layout.tsx`
- `apps/native/components/auth/AuthGuard.tsx`

**작업 내용**:
- [ ] AuthGuard 컴포넌트 생성
- [ ] 인증 상태 확인 로직
- [ ] 미인증 시 로그인 페이지 리다이렉트
- [ ] 프로필 미설정 시 프로필 설정 페이지 리다이렉트
- [ ] 네이티브 네비게이션 가드

### 9. OAuth 콜백 처리
**파일**:
- `apps/native/app/auth/callback.tsx`

**작업 내용**:
- [ ] 네이티브 딥링크 처리
- [ ] 인증 코드 교환
- [ ] 세션 설정
- [ ] 적절한 페이지로 리다이렉트

## Week 2 후반: 마무리 및 테스트

### 10. 웹뷰 통합 및 세션 전달
**파일**:
- `apps/native/components/webview/AuthenticatedWebView.tsx`
- `apps/web/lib/supabase/webview-client.ts`
- `apps/web/utils/auth-helpers.ts`

**작업 내용**:
- [ ] AuthenticatedWebView 컴포넌트 구현
- [ ] 세션 주입 로직 구현
- [ ] 웹뷰-네이티브 통신 프로토콜 정의
- [ ] 세션 업데이트 실시간 동기화
- [ ] 웹뷰 보안 설정 (도메인 화이트리스트)

### 11. 에러 처리 및 로딩 상태
**파일**:
- `apps/native/components/ui/ErrorMessage.tsx`
- `apps/native/components/ui/LoadingSpinner.tsx`

**작업 내용**:
- [ ] 에러 메시지 컴포넌트
- [ ] 로딩 스피너/스켈레톤
- [ ] 에러 바운더리 설정
- [ ] 사용자 친화적 메시지

### 12. 환경변수 및 설정 파일
**파일**:
- `apps/native/.env.example`
- 문서 업데이트

**작업 내용**:
- [ ] 환경변수 예제 파일 생성
- [ ] 설정 가이드 문서 작성
- [ ] OAuth 앱 설정 가이드

### 13. 테스트 및 디버깅
**작업 내용**:
- [ ] Google 로그인 플로우 테스트
- [ ] Apple 로그인 플로우 테스트
- [ ] Kakao 로그인 플로우 테스트
- [ ] 프로필 설정 플로우 테스트
- [ ] 세션 갱신 테스트
- [ ] 로그아웃 테스트
- [ ] 웹뷰 세션 주입 테스트
- [ ] 웹뷰-네이티브 통신 테스트
- [ ] 에러 시나리오 테스트
- [ ] 크로스 플랫폼 동작 확인

## 완료 기준

### 기능적 완료
- [ ] 3가지 소셜 로그인 모두 작동
- [ ] 신규 사용자 프로필 설정 완료
- [ ] 기존 사용자 자동 로그인
- [ ] 세션 관리 및 자동 갱신
- [ ] 로그아웃 기능

### 비기능적 완료
- [ ] 로그인 응답시간 < 2초
- [ ] 에러 처리 완료
- [ ] 타입 안전성 확보
- [ ] 웹/네이티브 일관된 UX
- [ ] 보안 요구사항 충족

## 주의사항
- 각 작업 완료 시 커밋 메시지는 명확하게 작성
- 타입스크립트 엄격 모드 유지
- 컴포넌트는 재사용 가능하게 설계
- 스타일은 플랫폼별 가이드라인 준수
- 민감한 정보는 환경변수로 관리