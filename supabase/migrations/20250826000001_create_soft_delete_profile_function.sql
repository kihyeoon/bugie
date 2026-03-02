-- ================================================================
-- 파일명: 20250826_create_soft_delete_profile_function.sql
-- 목적: profiles 테이블의 soft delete를 위한 RPC 함수 생성
-- 작성일: 2025-08-26
-- 
-- 문제점:
-- - profiles_own_all 정책의 USING 절에 deleted_at IS NULL 조건
-- - UPDATE 후 Supabase 클라이언트가 자동으로 RETURNING * 추가
-- - deleted_at이 설정된 행을 SELECT하려다 RLS 위반
--
-- 해결책:
-- - SECURITY DEFINER 함수로 RLS 우회
-- - RETURNING 절 없이 UPDATE 수행
-- - categories, transactions와 동일한 패턴 적용
-- ================================================================

-- 트랜잭션 시작
BEGIN;

-- 1. Soft delete 함수 생성
CREATE OR REPLACE FUNCTION soft_delete_profile()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 인증 확인
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  -- 이미 삭제된 프로필인지 확인
  IF EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND deleted_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Profile already deleted';
  END IF;
  
  -- Soft delete 수행 (RETURNING 없이)
  UPDATE profiles
  SET 
    deleted_at = NOW(),
    updated_at = NOW()
  WHERE id = auth.uid()
  AND deleted_at IS NULL;  -- 중복 삭제 방지
  
  -- 업데이트된 행이 없으면 오류
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found or already deleted';
  END IF;
  
  RETURN true;
END;
$$;

-- 2. 함수에 실행 권한 부여
GRANT EXECUTE ON FUNCTION soft_delete_profile() TO authenticated;

-- 3. 함수 설명 추가
COMMENT ON FUNCTION soft_delete_profile() IS 
'프로필 soft delete를 수행하는 RPC 함수. 
RLS 정책과 RETURNING 절의 충돌을 회피하기 위해 SECURITY DEFINER로 실행됩니다.
자신의 프로필만 삭제할 수 있으며, 이미 삭제된 프로필은 다시 삭제할 수 없습니다.';

-- 4. 함수 생성 확인
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'soft_delete_profile'
  ) THEN
    RAISE EXCEPTION 'soft_delete_profile 함수 생성 실패';
  END IF;
END $$;

-- 커밋
COMMIT;

-- ================================================================
-- 롤백 스크립트 (필요시 사용)
-- ================================================================
/*
DROP FUNCTION IF EXISTS soft_delete_profile();
*/

-- ================================================================
-- 테스트 쿼리 (필요시 사용)
-- ================================================================
/*
-- 함수 실행 테스트
SELECT soft_delete_profile();

-- 삭제 확인
SELECT id, email, deleted_at 
FROM profiles 
WHERE id = auth.uid();
*/