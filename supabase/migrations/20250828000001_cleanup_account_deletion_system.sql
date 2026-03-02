-- 회원 탈퇴 시스템 네이밍 정리 및 중복 제거
-- "익명화(anonymize)" 용어를 제거하고 실제 동작을 반영하는 명확한 네이밍으로 변경

BEGIN;

-- =====================================================
-- 1. deleted_accounts 테이블 정리
-- =====================================================
-- anonymized_at 컬럼 제거 (auth_deleted_at과 중복)
ALTER TABLE deleted_accounts 
DROP COLUMN IF EXISTS anonymized_at;

-- =====================================================
-- 2. deletion_job_logs 테이블 정리  
-- =====================================================
-- 컬럼명 변경: anonymized_count → profiles_processed
ALTER TABLE deletion_job_logs 
RENAME COLUMN anonymized_count TO profiles_processed;

-- =====================================================
-- 3. 테이블 및 컬럼 설명 추가
-- =====================================================
COMMENT ON TABLE deleted_accounts 
IS '탈퇴 요청된 계정 추적 (30일 유예 기간)';

COMMENT ON COLUMN deleted_accounts.deleted_at 
IS '탈퇴 요청 시점 (soft delete)';

COMMENT ON COLUMN deleted_accounts.auth_deleted_at 
IS '30일 후 auth.users에서 삭제된 시점';

COMMENT ON COLUMN deleted_accounts.email_hash 
IS '재가입 방지를 위한 이메일 해시';

COMMENT ON TABLE deletion_job_logs 
IS '계정 삭제 배치 작업 로그';

COMMENT ON COLUMN deletion_job_logs.profiles_processed 
IS '성공적으로 처리된 프로필 수';

COMMENT ON COLUMN deletion_job_logs.deleted_auth_count 
IS 'auth.users에서 삭제된 계정 수';

COMMENT ON COLUMN deletion_job_logs.error_count 
IS '처리 중 발생한 오류 수';

-- =====================================================
-- 4. process_account_deletions 함수 수정
-- =====================================================
CREATE OR REPLACE FUNCTION process_account_deletions()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_deleted_count INTEGER := 0;
  v_profiles_to_delete jsonb := '[]'::jsonb;
  v_result RECORD;
  v_start_time TIMESTAMP := NOW();
  v_end_time TIMESTAMP;
BEGIN
  -- 중복 실행 방지를 위한 advisory lock
  IF NOT pg_try_advisory_xact_lock(2147483647) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Another deletion process is already running'
    );
  END IF;

  -- 30일 경과한 탈퇴 계정 처리
  FOR v_result IN 
    SELECT id, email, deleted_at
    FROM profiles
    WHERE deleted_at IS NOT NULL
      AND deleted_at <= NOW() - INTERVAL '30 days'
      AND email NOT LIKE 'deleted-%'  -- 이미 처리된 것 제외
    ORDER BY deleted_at ASC
    LIMIT 50
  LOOP
    BEGIN
      -- 1. 이메일 해시 저장 (재가입 체크용)
      INSERT INTO deleted_accounts (
        original_user_id,
        email_hash,
        deleted_at
      ) VALUES (
        v_result.id,
        encode(sha256(v_result.email::bytea), 'hex'),
        v_result.deleted_at
      ) ON CONFLICT (original_user_id) 
      DO UPDATE SET 
        email_hash = EXCLUDED.email_hash;
      
      -- 2. profiles 삭제 
      -- CASCADE: ledger_members 자동 삭제
      -- SET NULL: transactions, budgets, ledgers의 created_by 자동 NULL 처리
      DELETE FROM profiles WHERE id = v_result.id;
      
      -- 3. auth.users 삭제 대상 목록에 추가
      v_profiles_to_delete := v_profiles_to_delete || jsonb_build_object(
        'user_id', v_result.id,
        'original_email', v_result.email,
        'deleted_at', v_result.deleted_at
      );
      
      v_deleted_count := v_deleted_count + 1;
      
    EXCEPTION WHEN OTHERS THEN
      -- 개별 사용자 처리 실패 시 로그만 남기고 계속 진행
      RAISE WARNING 'Failed to process user %: %', v_result.id, SQLERRM;
    END;
  END LOOP;
  
  v_end_time := NOW();
  
  -- 처리 결과 반환
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
      'error_detail', SQLSTATE
    );
END;
$$;

COMMIT;