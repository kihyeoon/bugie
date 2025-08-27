-- ================================================================
-- 파일명: 20250827_01_remove_cascade.sql
-- 목적: profiles 테이블의 auth.users CASCADE 제거 (가장 중요!)
-- 작성일: 2025-08-27
-- 
-- 문제점:
-- - 현재 profiles가 auth.users와 CASCADE로 연결됨
-- - auth.users 삭제 시 profiles도 함께 삭제되어 익명화 데이터 손실
--
-- 해결책:
-- - CASCADE를 NO ACTION으로 변경
-- - profiles는 유지되고 auth.users만 삭제 가능하게 함
-- ================================================================

BEGIN;

-- 1. 기존 외래 키 제약 삭제
ALTER TABLE profiles 
  DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- 2. CASCADE 없는 새 외래 키 추가
ALTER TABLE profiles
  ADD CONSTRAINT profiles_id_fkey 
    FOREIGN KEY (id) 
    REFERENCES auth.users(id) 
    ON DELETE NO ACTION;  -- CASCADE 제거!

-- 3. 변경 사항 검증
DO $$
DECLARE
  v_delete_rule text;
BEGIN
  -- 외래 키의 delete_rule 확인
  SELECT rc.delete_rule INTO v_delete_rule
  FROM information_schema.referential_constraints rc
  WHERE rc.constraint_name = 'profiles_id_fkey';
  
  -- CASCADE가 아닌지 확인
  IF v_delete_rule = 'CASCADE' THEN
    RAISE EXCEPTION 'CASCADE still exists! Migration failed.';
  END IF;
  
  -- NO ACTION인지 확인
  IF v_delete_rule != 'NO ACTION' THEN
    RAISE EXCEPTION 'Expected NO ACTION but got: %', v_delete_rule;
  END IF;
  
  RAISE NOTICE 'CASCADE successfully removed. Delete rule is now: %', v_delete_rule;
END $$;

-- 4. 테이블 구조 확인
DO $$
BEGIN
  -- profiles 테이블이 존재하는지 확인
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'profiles'
  ) THEN
    RAISE EXCEPTION 'profiles table does not exist';
  END IF;
  
  -- auth.users 참조가 올바른지 확인
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'profiles' 
    AND tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name = 'id'
  ) THEN
    RAISE EXCEPTION 'Foreign key constraint not properly created';
  END IF;
  
  RAISE NOTICE 'Foreign key constraint successfully updated';
END $$;

COMMIT;

-- ================================================================
-- 롤백 스크립트 (필요시 사용)
-- ================================================================
/*
BEGIN;
ALTER TABLE profiles 
  DROP CONSTRAINT IF EXISTS profiles_id_fkey;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_id_fkey 
    FOREIGN KEY (id) 
    REFERENCES auth.users(id) 
    ON DELETE CASCADE;
COMMIT;
*/

-- ================================================================
-- 테스트 쿼리
-- ================================================================
/*
-- 외래 키 상태 확인
SELECT 
  tc.table_name,
  tc.constraint_name,
  rc.delete_rule,
  rc.update_rule
FROM information_schema.table_constraints tc
JOIN information_schema.referential_constraints rc
  ON tc.constraint_name = rc.constraint_name
WHERE tc.table_name = 'profiles'
AND tc.constraint_type = 'FOREIGN KEY';
*/