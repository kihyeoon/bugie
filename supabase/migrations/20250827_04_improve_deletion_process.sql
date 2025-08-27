-- ================================================================
-- 파일명: 20250827_04_improve_deletion_process.sql
-- 목적: 회원 탈퇴 프로세스 개선 - 완전 삭제 방식 적용
-- 작성일: 2025-08-27
--
-- 변경사항:
-- 1. created_by 컬럼을 NULL 허용으로 변경
-- 2. 익명화 없이 완전 삭제하는 새로운 RPC 함수
-- 3. 테스트 및 수동 처리용 함수 추가
-- ================================================================

BEGIN;

-- ================================================================
-- 1. 테이블 구조 변경: created_by 컬럼 NULL 허용
-- ================================================================

-- transactions 테이블
ALTER TABLE transactions 
ALTER COLUMN created_by DROP NOT NULL;

-- ledgers 테이블  
ALTER TABLE ledgers 
ALTER COLUMN created_by DROP NOT NULL;

-- budgets 테이블
ALTER TABLE budgets 
ALTER COLUMN created_by DROP NOT NULL;

-- 변경 사항 검증
DO $$
BEGIN
  -- NULL 허용 여부 확인
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transactions' 
    AND column_name = 'created_by'
    AND is_nullable = 'NO'
  ) THEN
    RAISE EXCEPTION 'transactions.created_by is still NOT NULL';
  END IF;
  
  RAISE NOTICE 'Column constraints updated successfully';
END $$;

-- ================================================================
-- 2. 개선된 계정 삭제 함수 (익명화 없이 완전 삭제)
-- ================================================================

CREATE OR REPLACE FUNCTION process_account_deletions_clean()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result RECORD;
  v_deleted_count INTEGER := 0;
  v_profiles_to_delete JSONB := '[]'::JSONB;
  v_email_hash TEXT;
  v_start_time TIMESTAMPTZ;
  v_end_time TIMESTAMPTZ;
BEGIN
  v_start_time := NOW();
  
  -- 30일 경과한 탈퇴 계정 처리
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
      AND p.email NOT LIKE 'deleted-%'  -- 이미 처리된 것 제외
      AND (da.id IS NULL OR da.auth_deleted_at IS NULL)  -- 미처리 계정만
    ORDER BY p.deleted_at ASC
    LIMIT 50
  LOOP
    BEGIN
      -- 1. 이메일 해시 생성 (재가입 체크용)
      v_email_hash := encode(sha256(v_result.email::bytea), 'hex');
      
      -- 2. deleted_accounts에 기록 (재가입 방지용)
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
        SET anonymized_at = NOW();
      
      -- 3. 관련 테이블의 created_by를 NULL로 설정 (데이터는 보존)
      UPDATE transactions 
      SET created_by = NULL
      WHERE created_by = v_result.id;
      
      UPDATE budgets 
      SET created_by = NULL
      WHERE created_by = v_result.id;
      
      UPDATE ledgers 
      SET created_by = NULL
      WHERE created_by = v_result.id;
      
      -- 4. ledger_members에서 완전 삭제
      DELETE FROM ledger_members 
      WHERE user_id = v_result.id;
      
      -- 5. profiles 완전 삭제
      DELETE FROM profiles 
      WHERE id = v_result.id;
      
      -- 6. Auth 삭제 대상 목록에 추가
      v_profiles_to_delete := v_profiles_to_delete || jsonb_build_object(
        'user_id', v_result.id,
        'original_email', v_result.email,
        'deleted_at', v_result.deleted_at,
        'auth_can_delete', true
      );
      
      v_deleted_count := v_deleted_count + 1;
      
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to process user %: %', v_result.id, SQLERRM;
    END;
  END LOOP;
  
  v_end_time := NOW();
  
  RETURN json_build_object(
    'success', true,
    'deleted_count', v_deleted_count,
    'profiles_to_delete', v_profiles_to_delete,
    'processed_at', v_start_time,
    'completed_at', v_end_time,
    'duration_ms', EXTRACT(MILLISECOND FROM (v_end_time - v_start_time))
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM,
      'error_detail', SQLSTATE,
      'processed_at', v_start_time
    );
END;
$$;

-- ================================================================
-- 3. 특정 사용자 강제 삭제 함수 (테스트/수동 처리용)
-- ================================================================

CREATE OR REPLACE FUNCTION force_clean_user(target_user_id UUID)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
  v_profile_deleted BOOLEAN := false;
  v_auth_deleted BOOLEAN := false;
BEGIN
  -- 현재 상태 확인
  SELECT email INTO v_email FROM profiles WHERE id = target_user_id;
  
  IF v_email IS NULL THEN
    -- profiles에 없으면 auth.users 확인
    SELECT email INTO v_email FROM auth.users WHERE id = target_user_id;
    IF v_email IS NULL THEN
      RETURN json_build_object(
        'success', false,
        'error', 'User not found in profiles or auth.users'
      );
    END IF;
  END IF;
  
  -- 1. 이메일 해시 생성 및 deleted_accounts 기록
  IF v_email IS NOT NULL AND NOT v_email LIKE 'deleted-%' THEN
    INSERT INTO deleted_accounts (
      original_user_id,
      email_hash,
      deleted_at,
      anonymized_at
    ) VALUES (
      target_user_id,
      encode(sha256(v_email::bytea), 'hex'),
      NOW(),
      NOW()
    ) ON CONFLICT (original_user_id) DO UPDATE
      SET anonymized_at = NOW();
  END IF;
  
  -- 2. transactions의 created_by를 NULL로
  UPDATE transactions 
  SET created_by = NULL
  WHERE created_by = target_user_id;
  
  -- 3. budgets의 created_by를 NULL로
  UPDATE budgets 
  SET created_by = NULL
  WHERE created_by = target_user_id;
  
  -- 4. ledgers의 created_by를 NULL로
  UPDATE ledgers 
  SET created_by = NULL
  WHERE created_by = target_user_id;
  
  -- 5. ledger_members에서 삭제
  DELETE FROM ledger_members 
  WHERE user_id = target_user_id;
  
  -- 6. profiles 삭제 시도
  DELETE FROM profiles 
  WHERE id = target_user_id;
  v_profile_deleted := FOUND;
  
  -- 7. auth.users 삭제 시도
  BEGIN
    DELETE FROM auth.users 
    WHERE id = target_user_id;
    v_auth_deleted := FOUND;
    
    -- 8. deleted_accounts 업데이트
    IF v_auth_deleted THEN
      UPDATE deleted_accounts
      SET auth_deleted_at = NOW()
      WHERE original_user_id = target_user_id;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- auth.users 삭제 실패해도 계속
    v_auth_deleted := false;
  END;
  
  RETURN json_build_object(
    'success', true,
    'email', v_email,
    'profile_deleted', v_profile_deleted,
    'auth_deleted', v_auth_deleted,
    'message', 'User cleaned successfully'
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

-- ================================================================
-- 4. 권한 설정
-- ================================================================

-- 새로운 함수들에 대한 권한 설정
REVOKE ALL ON FUNCTION process_account_deletions_clean() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION process_account_deletions_clean() TO service_role;
GRANT EXECUTE ON FUNCTION process_account_deletions_clean() TO postgres;

REVOKE ALL ON FUNCTION force_clean_user(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION force_clean_user(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION force_clean_user(UUID) TO postgres;

-- ================================================================
-- 5. 함수 설명 추가
-- ================================================================

COMMENT ON FUNCTION process_account_deletions_clean() IS 
'30일 경과한 탈퇴 계정을 완전 삭제합니다. 익명화 없이 profiles와 auth.users를 삭제하며,
관련 테이블의 created_by는 NULL로 설정하여 데이터를 보존합니다.
GitHub Actions에서 매일 실행되며, 배치 크기는 50개로 제한됩니다.';

COMMENT ON FUNCTION force_clean_user(UUID) IS 
'특정 사용자를 강제로 삭제합니다. 테스트 및 수동 처리용 함수입니다.
관련된 모든 참조를 정리하고 profiles와 auth.users를 삭제합니다.';

-- ================================================================
-- 6. 검증
-- ================================================================

DO $$
BEGIN
  -- 함수 생성 확인
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'process_account_deletions_clean'
  ) THEN
    RAISE EXCEPTION 'process_account_deletions_clean function creation failed';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'force_clean_user'
  ) THEN
    RAISE EXCEPTION 'force_clean_user function creation failed';
  END IF;
  
  RAISE NOTICE 'All functions created successfully';
END $$;

COMMIT;

-- ================================================================
-- 롤백 스크립트 (필요시 사용)
-- ================================================================
/*
BEGIN;

-- 함수 삭제
DROP FUNCTION IF EXISTS process_account_deletions_clean();
DROP FUNCTION IF EXISTS force_clean_user(UUID);

-- 컬럼 제약 복구 (주의: 기존 NULL 데이터가 있으면 실패)
ALTER TABLE transactions ALTER COLUMN created_by SET NOT NULL;
ALTER TABLE ledgers ALTER COLUMN created_by SET NOT NULL;
ALTER TABLE budgets ALTER COLUMN created_by SET NOT NULL;

COMMIT;
*/

-- ================================================================
-- 사용 예시
-- ================================================================
/*
-- 1. 30일 경과 계정 일괄 처리
SELECT process_account_deletions_clean();

-- 2. 특정 사용자 강제 삭제
SELECT force_clean_user('user-uuid-here');

-- 3. 처리 대상 확인
SELECT 
  COUNT(*) as pending_count
FROM profiles
WHERE deleted_at IS NOT NULL
  AND deleted_at <= NOW() - INTERVAL '30 days'
  AND email NOT LIKE 'deleted-%';
*/