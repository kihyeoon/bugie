-- ================================================================
-- 파일명: 20250827_02_create_tracking_tables.sql
-- 목적: 탈퇴 계정 추적 및 작업 로그 테이블 생성
-- 작성일: 2025-08-27
-- 
-- 생성 테이블:
-- 1. deleted_accounts - 탈퇴 계정 영구 기록 (재가입 체크용)
-- 2. deletion_job_logs - GitHub Actions 실행 로그 (모니터링용)
-- ================================================================

BEGIN;

-- 1. 탈퇴 계정 추적 테이블
CREATE TABLE IF NOT EXISTS deleted_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  original_user_id UUID NOT NULL,
  email_hash TEXT NOT NULL,  -- SHA256 해시로 저장 (개인정보 보호)
  deleted_at TIMESTAMPTZ NOT NULL,  -- 탈퇴 요청 시점
  anonymized_at TIMESTAMPTZ,        -- 익명화 처리 시점
  auth_deleted_at TIMESTAMPTZ,      -- auth.users 삭제 시점
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- 유저당 1개 레코드만 허용
  CONSTRAINT unique_original_user UNIQUE(original_user_id)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_deleted_accounts_email_hash 
  ON deleted_accounts(email_hash);

CREATE INDEX IF NOT EXISTS idx_deleted_accounts_dates 
  ON deleted_accounts(deleted_at, anonymized_at);

-- 코멘트 추가
COMMENT ON TABLE deleted_accounts IS 
'탈퇴한 계정의 영구 기록. 재가입 체크 및 감사 추적용.';

COMMENT ON COLUMN deleted_accounts.email_hash IS 
'이메일의 SHA256 해시. 재가입 시 중복 체크용.';

COMMENT ON COLUMN deleted_accounts.deleted_at IS 
'profiles.deleted_at 값. 탈퇴 요청 시점.';

COMMENT ON COLUMN deleted_accounts.anonymized_at IS 
'프로필 익명화 처리 완료 시점.';

COMMENT ON COLUMN deleted_accounts.auth_deleted_at IS 
'auth.users에서 실제 삭제된 시점.';

-- 2. 자동화 작업 실행 로그 테이블
CREATE TABLE IF NOT EXISTS deletion_job_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  executed_at TIMESTAMPTZ DEFAULT NOW(),
  anonymized_count INTEGER DEFAULT 0,     -- 익명화 처리된 계정 수
  deleted_auth_count INTEGER DEFAULT 0,   -- auth.users에서 삭제된 계정 수
  error_count INTEGER DEFAULT 0,          -- 발생한 에러 수
  errors JSONB,                           -- 에러 상세 정보 (있을 경우)
  details JSONB,                          -- 추가 실행 정보
  created_by TEXT DEFAULT 'github-actions',
  
  -- 인덱스: 최근 로그 조회용
  CHECK (anonymized_count >= 0),
  CHECK (deleted_auth_count >= 0),
  CHECK (error_count >= 0)
);

-- 실행 시간 인덱스 (최근 로그 조회 최적화)
CREATE INDEX IF NOT EXISTS idx_deletion_job_logs_executed 
  ON deletion_job_logs(executed_at DESC);

-- 코멘트 추가
COMMENT ON TABLE deletion_job_logs IS 
'GitHub Actions 탈퇴 처리 작업의 실행 로그. 모니터링 및 디버깅용.';

COMMENT ON COLUMN deletion_job_logs.anonymized_count IS 
'이번 실행에서 익명화 처리된 프로필 수.';

COMMENT ON COLUMN deletion_job_logs.deleted_auth_count IS 
'이번 실행에서 auth.users에서 삭제된 계정 수.';

COMMENT ON COLUMN deletion_job_logs.errors IS 
'발생한 에러들의 상세 정보. [{user_id, error_message}, ...]';

-- 3. RLS 정책 설정 (보안)
ALTER TABLE deleted_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE deletion_job_logs ENABLE ROW LEVEL SECURITY;

-- deleted_accounts는 서비스 역할만 접근 가능
CREATE POLICY "deleted_accounts_service_only" ON deleted_accounts
  FOR ALL 
  USING (auth.jwt() ->> 'role' = 'service_role');

-- deletion_job_logs는 서비스 역할만 쓰기, authenticated는 읽기 가능
CREATE POLICY "deletion_job_logs_select" ON deletion_job_logs
  FOR SELECT
  USING (true);  -- 모든 인증된 사용자가 로그 조회 가능

CREATE POLICY "deletion_job_logs_insert" ON deletion_job_logs
  FOR INSERT
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- 4. 테이블 생성 검증
DO $$
BEGIN
  -- deleted_accounts 테이블 확인
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'deleted_accounts'
  ) THEN
    RAISE EXCEPTION 'deleted_accounts table creation failed';
  END IF;
  
  -- deletion_job_logs 테이블 확인
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'deletion_job_logs'
  ) THEN
    RAISE EXCEPTION 'deletion_job_logs table creation failed';
  END IF;
  
  -- 인덱스 확인
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_deleted_accounts_email_hash'
  ) THEN
    RAISE EXCEPTION 'Email hash index creation failed';
  END IF;
  
  RAISE NOTICE 'All tracking tables created successfully';
END $$;

COMMIT;

-- ================================================================
-- 롤백 스크립트 (필요시 사용)
-- ================================================================
/*
BEGIN;
DROP TABLE IF EXISTS deletion_job_logs CASCADE;
DROP TABLE IF EXISTS deleted_accounts CASCADE;
COMMIT;
*/

-- ================================================================
-- 테스트 쿼리
-- ================================================================
/*
-- 테이블 구조 확인
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name IN ('deleted_accounts', 'deletion_job_logs')
ORDER BY table_name, ordinal_position;

-- RLS 정책 확인
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename IN ('deleted_accounts', 'deletion_job_logs');
*/