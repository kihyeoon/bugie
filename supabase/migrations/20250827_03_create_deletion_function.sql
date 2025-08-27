-- ================================================================
-- 파일명: 20250827_03_create_deletion_function.sql  
-- 목적: 30일 경과한 탈퇴 계정 익명화 처리 RPC 함수
-- 작성일: 2025-08-27
--
-- 기능:
-- 1. 30일 경과한 삭제 계정 찾기
-- 2. deleted_accounts 테이블에 기록
-- 3. profiles 익명화 (email, name 변경)
-- 4. auth.users 삭제 대상 목록 반환
-- ================================================================

BEGIN;

-- 익명화 처리 함수
CREATE OR REPLACE FUNCTION process_account_deletions()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result RECORD;
  v_anonymized_count INTEGER := 0;
  v_profiles_to_delete JSONB := '[]'::JSONB;
  v_anonymous_id TEXT;
  v_email_hash TEXT;
  v_start_time TIMESTAMPTZ;
  v_end_time TIMESTAMPTZ;
BEGIN
  -- 처리 시작 시간 기록
  v_start_time := NOW();
  
  -- 30일 경과한 탈퇴 계정 처리 (배치 크기 50)
  FOR v_result IN 
    SELECT 
      p.id,
      p.email,
      p.full_name,
      p.deleted_at
    FROM profiles p
    LEFT JOIN deleted_accounts da ON da.original_user_id = p.id
    WHERE p.deleted_at IS NOT NULL
      AND p.deleted_at <= NOW() - INTERVAL '30 days'
      AND p.email NOT LIKE 'deleted-%'  -- 이미 익명화된 계정 제외
      AND da.id IS NULL  -- deleted_accounts에 없는 것만
    ORDER BY p.deleted_at ASC  -- 오래된 것부터 처리
    LIMIT 50  -- Rate limit 고려한 배치 크기
  LOOP
    BEGIN
      -- 익명 ID 생성 (UUID의 MD5 해시 앞 8자)
      v_anonymous_id := SUBSTR(MD5(v_result.id::text), 1, 8);
      
      -- 이메일 해시 생성 (SHA256)
      v_email_hash := encode(sha256(v_result.email::bytea), 'hex');
      
      -- 1. 삭제 계정 기록 (개인정보는 해시로만 저장)
      INSERT INTO deleted_accounts (
        original_user_id,
        email_hash,
        deleted_at,
        anonymized_at
      ) VALUES (
        v_result.id,
        v_email_hash,
        v_result.deleted_at,
        NOW()
      ) ON CONFLICT (original_user_id) DO UPDATE
        SET anonymized_at = NOW()
        WHERE deleted_accounts.anonymized_at IS NULL;
      
      -- 2. 프로필 익명화
      UPDATE profiles 
      SET 
        email = 'deleted-' || v_anonymous_id || '@anon.local',
        full_name = '탈퇴한 사용자',
        avatar_url = NULL,
        updated_at = NOW()
      WHERE id = v_result.id
        AND email NOT LIKE 'deleted-%';  -- 중복 방지
      
      -- 3. Auth 삭제 대상 목록에 추가
      v_profiles_to_delete := v_profiles_to_delete || jsonb_build_object(
        'user_id', v_result.id,
        'original_email', v_result.email,  -- 로깅용 (GitHub Actions에서만 사용)
        'deleted_at', v_result.deleted_at
      );
      
      v_anonymized_count := v_anonymized_count + 1;
      
    EXCEPTION WHEN OTHERS THEN
      -- 개별 레코드 처리 실패 시 로그 후 계속
      RAISE WARNING 'Failed to process user %: %', v_result.id, SQLERRM;
    END;
  END LOOP;
  
  -- 처리 종료 시간
  v_end_time := NOW();
  
  -- 처리 결과 반환
  RETURN json_build_object(
    'success', true,
    'anonymized_count', v_anonymized_count,
    'profiles_to_delete', v_profiles_to_delete,
    'processed_at', v_start_time,
    'completed_at', v_end_time,
    'duration_ms', EXTRACT(MILLISECOND FROM (v_end_time - v_start_time))
  );
  
EXCEPTION
  WHEN OTHERS THEN
    -- 전체 처리 실패 시
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM,
      'error_detail', SQLSTATE,
      'processed_at', v_start_time
    );
END;
$$;

-- 함수 설명 추가
COMMENT ON FUNCTION process_account_deletions() IS 
'30일 경과한 탈퇴 계정을 익명화하고 auth.users 삭제 대상 목록을 반환합니다.
GitHub Actions에서 매일 실행되며, 배치 크기는 50개로 제한됩니다.
반환값: {success, anonymized_count, profiles_to_delete[], processed_at, completed_at, duration_ms}';

-- 권한 설정 (service_role과 postgres만 실행 가능)
REVOKE ALL ON FUNCTION process_account_deletions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION process_account_deletions() TO service_role;
GRANT EXECUTE ON FUNCTION process_account_deletions() TO postgres;

-- 함수 생성 검증
DO $$
BEGIN
  -- 함수가 생성되었는지 확인
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'process_account_deletions'
  ) THEN
    RAISE EXCEPTION 'process_account_deletions function creation failed';
  END IF;
  
  -- 반환 타입이 json인지 확인
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_type t ON p.prorettype = t.oid
    WHERE p.proname = 'process_account_deletions'
    AND t.typname = 'json'
  ) THEN
    RAISE EXCEPTION 'Function return type is not json';
  END IF;
  
  RAISE NOTICE 'RPC function created successfully';
END $$;

COMMIT;

-- ================================================================
-- 롤백 스크립트 (필요시 사용)
-- ================================================================
/*
DROP FUNCTION IF EXISTS process_account_deletions();
*/

-- ================================================================
-- 테스트 쿼리
-- ================================================================
/*
-- 함수 정보 확인
SELECT 
  proname as function_name,
  prorettype::regtype as return_type,
  prosecdef as security_definer,
  proconfig as configuration
FROM pg_proc
WHERE proname = 'process_account_deletions';

-- 권한 확인
SELECT 
  grantee,
  privilege_type
FROM information_schema.routine_privileges
WHERE routine_name = 'process_account_deletions';

-- 테스트 데이터로 함수 실행 (개발 환경에서만)
-- 먼저 테스트 데이터 생성
INSERT INTO profiles (id, email, full_name, deleted_at)
VALUES (
  gen_random_uuid(),
  'test-deletion@example.com',
  'Test Deletion User',
  NOW() - INTERVAL '31 days'
);

-- 함수 실행
SELECT process_account_deletions();

-- 결과 확인
SELECT * FROM profiles WHERE email LIKE 'deleted-%';
SELECT * FROM deleted_accounts ORDER BY created_at DESC LIMIT 5;
*/