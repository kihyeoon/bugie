# 로컬 Supabase 개발 환경 설정

작성일: 2026-03-02

## 배경

기존에는 프로덕션 Supabase만 사용했으나, 안전한 개발/테스트를 위해 로컬 Supabase 환경을 구축했다.

## 설치 및 초기화

```bash
# Supabase CLI 설치 (루트 dev dependency)
pnpm add supabase --save-dev -w

# 프로젝트 초기화 (supabase/ 디렉토리 + config.toml 생성)
npx supabase init
```

## 로컬 서비스 접속 정보

```bash
npx supabase start   # Docker 기반 로컬 스택 실행
npx supabase stop    # 종료
```

| 서비스 | URL |
|--------|-----|
| API | http://127.0.0.1:54321 |
| DB | postgresql://postgres:postgres@127.0.0.1:54322/postgres |
| Studio | http://127.0.0.1:54323 |
| Mailpit | http://127.0.0.1:54324 |

## 마이그레이션 파일명 수정

기존 파일명이 Supabase CLI 규칙에 맞지 않아 전체 리네이밍했다.

```
# Before (충돌 발생)
20250729_001_initial_schema.sql
20250729_002_functions_and_triggers.sql
→ 둘 다 version "20250729"로 인식되어 충돌

# After (14자리 고유 타임스탬프)
20250729000001_initial_schema.sql
20250729000002_functions_and_triggers.sql
```

**규칙**: `YYYYMMDDHHMMSS_name.sql` — `_` 앞 숫자가 version key이므로 중복 불가.

## RLS 순서 오류 수정

`initial_schema.sql`에서 `ledgers_policy`가 `ledger_members` 테이블 생성 전에 실행되어 에러가 발생했다. 정책 생성 위치를 `ledger_members` 테이블 생성 후로 이동하여 해결.

## 환경변수 설정

### .env.local (로컬 개발용)

```env
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...  # JWT 기반 anon key

EXPO_PUBLIC_SUPABASE_URL=http://<Mac_IP>:54321  # 실제 기기용
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...         # JWT 기반 anon key
```

### 키 형식 주의

Supabase CLI 신버전은 `sb_publishable_...` 형식의 키를 발급하지만, `@supabase/supabase-js` 클라이언트는 **JWT 기반 anon key**가 필요하다.

```bash
# JWT 기반 키 확인
npx supabase status -o env | grep ANON_KEY
```

### 환경 전환

```bash
# 프로덕션으로 복원
cp .env.production .env.local
```

`.env.production`에 프로덕션 값이 백업되어 있다 (gitignore됨).

## 실제 기기 테스트

- iOS 시뮬레이터: `127.0.0.1`로 Mac 호스트 직접 접근 가능
- 실제 기기: Mac의 로컬 IP 사용 (예: `http://172.30.1.73:54321`)

## 명령어 정리

```bash
# 로컬 서비스
npx supabase start                    # 실행
npx supabase stop                     # 종료
npx supabase status                   # 상태 확인

# 마이그레이션
npx supabase migration new <name>     # 새 마이그레이션 파일 생성
npx supabase migration up             # 새 마이그레이션만 적용 (데이터 유지)
npx supabase db reset                 # 전체 초기화 + 마이그레이션 + seed

# 프로덕션 배포
npx supabase db push --dry-run        # 미리보기
npx supabase db push                  # 실제 배포
```
