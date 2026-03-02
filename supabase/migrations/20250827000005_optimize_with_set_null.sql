-- ================================================================
-- 파일명: 20250827_06_optimize_with_set_null.sql
-- 목적: ON DELETE SET NULL을 활용한 회원 탈퇴 처리 최적화
-- 작성일: 2025-08-27
-- 
-- 개선사항:
-- - 외래키 제약을 ON DELETE SET NULL로 변경
-- - profiles 삭제 시 자동으로 NULL 처리
-- - 함수 로직 대폭 간소화 (100줄 → 30줄)
-- - 새 테이블 추가 시 자동 처리
-- ================================================================

BEGIN;

-- ================================================================
-- 1. 외래키 제약 변경: NO ACTION → SET NULL
-- ================================================================

-- transactions.created_by
ALTER TABLE transactions 
  DROP CONSTRAINT IF EXISTS transactions_created_by_fkey;

ALTER TABLE transactions
  ADD CONSTRAINT transactions_created_by_fkey 
  FOREIGN KEY (created_by) 
  REFERENCES profiles(id) 
  ON DELETE SET NULL;

-- budgets.created_by  
ALTER TABLE budgets 
  DROP CONSTRAINT IF EXISTS budgets_created_by_fkey;

ALTER TABLE budgets
  ADD CONSTRAINT budgets_created_by_fkey 
  FOREIGN KEY (created_by) 
  REFERENCES profiles(id) 
  ON DELETE SET NULL;

-- ledgers.created_by
ALTER TABLE ledgers 
  DROP CONSTRAINT IF EXISTS ledgers_created_by_fkey;

ALTER TABLE ledgers
  ADD CONSTRAINT ledgers_created_by_fkey 
  FOREIGN KEY (created_by) 
  REFERENCES profiles(id) 
  ON DELETE SET NULL;

-- Note: ledger_members.user_id는 CASCADE 유지 (멤버 정보는 삭제되어야 함)

-- ================================================================
-- 2. 간소화된 삭제 처리 함수
-- ================================================================

CREATE OR REPLACE FUNCTION process_account_deletions()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
        deleted_at,
        anonymized_at
      ) VALUES (
        v_result.id,
        encode(sha256(v_result.email::bytea), 'hex'),
        v_result.deleted_at,
        NOW()
      ) ON CONFLICT (original_user_id) 
      DO UPDATE SET 
        anonymized_at = NOW();
      
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

-- ================================================================
-- 3. 기존 복잡한 함수 제거
-- ================================================================

DROP FUNCTION IF EXISTS process_account_deletions_clean();

-- force_clean_user는 유지 (수동 처리용으로 유용)

-- ================================================================
-- 4. 함수 설명 추가
-- ================================================================

COMMENT ON FUNCTION process_account_deletions() IS 
'30일 경과한 탈퇴 계정을 처리하는 최적화된 함수.
ON DELETE SET NULL을 활용하여 자동으로 참조를 NULL 처리합니다.
새로운 테이블이 추가되어도 외래키만 적절히 설정하면 자동으로 작동합니다.';

-- ================================================================
-- 5. 확인 쿼리
-- ================================================================

-- 외래키 제약 변경 확인
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM information_schema.referential_constraints rc
  JOIN information_schema.table_constraints tc 
    ON rc.constraint_name = tc.constraint_name
  WHERE tc.table_name IN ('transactions', 'budgets', 'ledgers')
    AND rc.delete_rule = 'SET NULL';
  
  IF v_count != 3 THEN
    RAISE EXCEPTION 'Foreign key constraints were not properly updated to SET NULL';
  END IF;
  
  RAISE NOTICE 'All foreign key constraints successfully updated to SET NULL';
END $$;

COMMIT;

-- ================================================================
-- 롤백 스크립트 (필요시 사용)
-- ================================================================
/*
BEGIN;

-- 외래키를 다시 NO ACTION으로 변경
ALTER TABLE transactions 
  DROP CONSTRAINT transactions_created_by_fkey;
ALTER TABLE transactions
  ADD CONSTRAINT transactions_created_by_fkey 
  FOREIGN KEY (created_by) 
  REFERENCES profiles(id) 
  ON DELETE NO ACTION;

ALTER TABLE budgets 
  DROP CONSTRAINT budgets_created_by_fkey;
ALTER TABLE budgets
  ADD CONSTRAINT budgets_created_by_fkey 
  FOREIGN KEY (created_by) 
  REFERENCES profiles(id) 
  ON DELETE NO ACTION;

ALTER TABLE ledgers 
  DROP CONSTRAINT ledgers_created_by_fkey;
ALTER TABLE ledgers
  ADD CONSTRAINT ledgers_created_by_fkey 
  FOREIGN KEY (created_by) 
  REFERENCES profiles(id) 
  ON DELETE NO ACTION;

-- 이전 함수 복원 필요 시 20250827_04_improve_deletion_process.sql 참조

COMMIT;
*/