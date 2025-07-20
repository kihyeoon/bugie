# 인증 시스템 구현 작업 목록

## 개요
네이티브 앱에서만 인증을 구현하고, 웹뷰에는 세션을 전달하는 구조로 개발합니다.

## Week 1: 백엔드 및 기초 설정

### 1. Supabase 프로젝트 설정 및 OAuth 구성
**파일**: 없음 (Supabase 대시보드 작업)
**작업 내용**:
- [ ] Supabase 프로젝트에서 Authentication 설정 활성화
- [ ] Google OAuth 앱 생성 및 Client ID/Secret 설정
- [ ] Apple OAuth 설정 (Apple Developer 계정 필요)
- [ ] Kakao OAuth 앱 생성 및 설정
- [ ] 리다이렉트 URL 구성:
  - 웹: `https://{project-ref}.supabase.co/auth/v1/callback`
  - 로컬: `http://localhost:3000/auth/callback`
- [ ] 환경변수 파일 업데이트

### 2. 데이터베이스 마이그레이션 작성
**파일**: `supabase/migrations/001_create_profiles_table.sql`
**작업 내용**:
- [ ] profiles 테이블 생성 SQL 작성
- [ ] RLS 정책 추가
- [ ] handle_new_user() 함수 생성
- [ ] 트리거 설정
- [ ] 마이그레이션 실행 및 테스트

### 3. 공통 타입 패키지 생성
**파일**: 
- `packages/types/package.json`
- `packages/types/tsconfig.json`
- `packages/types/src/index.ts`
- `packages/types/src/auth.ts`

**작업 내용**:
- [ ] @repo/types 패키지 초기화
- [ ] TypeScript 설정
- [ ] auth.ts에 User, Profile, Session, AuthState 타입 정의
- [ ] index.ts에서 export
- [ ] 빌드 스크립트 설정

### 4. Supabase 클라이언트 구성
**파일**:
- `apps/web/lib/supabase/client.ts` (수정)
- `apps/web/lib/supabase/server.ts` (수정)
- `apps/web/lib/supabase/auth.ts` (생성)
- `apps/native/utils/supabase.ts` (수정)

**작업 내용**:
- [ ] 웹용 브라우저 클라이언트 설정
- [ ] 웹용 서버 클라이언트 설정
- [ ] 네이티브용 클라이언트 설정 (AsyncStorage 연동)
- [ ] 인증 관련 헬퍼 함수 작성
- [ ] 타입 안전성 확보

## Week 2: 프론트엔드 구현

### 5. AuthContext 구현
**파일**:
- `apps/web/contexts/AuthContext.tsx`
- `apps/native/contexts/AuthContext.tsx`
- `apps/web/hooks/useAuth.ts`
- `apps/native/hooks/useAuth.ts`

**작업 내용**:
- [ ] AuthContext Provider 컴포넌트 생성
- [ ] 인증 상태 관리 로직
- [ ] 세션 자동 갱신 설정
- [ ] signInWithOAuth 함수 구현
- [ ] signOut 함수 구현
- [ ] updateProfile 함수 구현
- [ ] useAuth 훅 생성

### 6. 로그인 화면 구현
**파일**:
- `apps/web/app/(auth)/login/page.tsx`
- `apps/web/app/(auth)/layout.tsx`
- `apps/web/components/auth/SocialLoginButton.tsx`
- `apps/native/app/(auth)/login.tsx`
- `apps/native/app/(auth)/_layout.tsx`
- `apps/native/components/auth/SocialLoginButton.tsx`

**작업 내용**:
- [ ] 웹 로그인 페이지 레이아웃
- [ ] 네이티브 로그인 스크린 레이아웃
- [ ] SocialLoginButton 컴포넌트 (재사용 가능)
- [ ] 로딩 상태 처리
- [ ] 에러 메시지 표시
- [ ] 브랜드 로고 및 스타일링

### 7. 프로필 설정 화면 구현
**파일**:
- `apps/web/app/(auth)/profile-setup/page.tsx`
- `apps/web/components/auth/ProfileForm.tsx`
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
- `apps/web/app/(protected)/layout.tsx`
- `apps/web/components/auth/AuthGuard.tsx`
- `apps/web/middleware.ts`
- `apps/native/app/(tabs)/_layout.tsx`
- `apps/native/components/auth/AuthGuard.tsx`

**작업 내용**:
- [ ] AuthGuard 컴포넌트 생성
- [ ] 인증 상태 확인 로직
- [ ] 미인증 시 로그인 페이지 리다이렉트
- [ ] 프로필 미설정 시 프로필 설정 페이지 리다이렉트
- [ ] 웹용 미들웨어 설정
- [ ] 네이티브 네비게이션 가드

### 9. OAuth 콜백 처리
**파일**:
- `apps/web/app/auth/callback/route.ts`
- `apps/native/app/auth/callback.tsx`

**작업 내용**:
- [ ] 웹 OAuth 콜백 라우트 핸들러
- [ ] 네이티브 딥링크 처리
- [ ] 인증 코드 교환
- [ ] 세션 설정
- [ ] 적절한 페이지로 리다이렉트

## Week 2 후반: 마무리 및 테스트

### 10. 에러 처리 및 로딩 상태
**파일**:
- `apps/web/components/ui/ErrorMessage.tsx`
- `apps/web/components/ui/LoadingSpinner.tsx`
- `apps/native/components/ui/ErrorMessage.tsx`
- `apps/native/components/ui/LoadingSpinner.tsx`

**작업 내용**:
- [ ] 에러 메시지 컴포넌트
- [ ] 로딩 스피너/스켈레톤
- [ ] 에러 바운더리 설정
- [ ] 사용자 친화적 메시지

### 11. 환경변수 및 설정 파일
**파일**:
- `apps/web/.env.local.example`
- `apps/native/.env.example`
- 문서 업데이트

**작업 내용**:
- [ ] 환경변수 예제 파일 생성
- [ ] 설정 가이드 문서 작성
- [ ] OAuth 앱 설정 가이드

### 12. 테스트 및 디버깅
**작업 내용**:
- [ ] Google 로그인 플로우 테스트
- [ ] Apple 로그인 플로우 테스트
- [ ] Kakao 로그인 플로우 테스트
- [ ] 프로필 설정 플로우 테스트
- [ ] 세션 갱신 테스트
- [ ] 로그아웃 테스트
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