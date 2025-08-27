-- ================================================================
-- 파일명: 20250827_08_cleanup_unused_function.sql
-- 목적: 사용하지 않는 handle_new_user 함수 제거
-- 작성일: 2025-08-27
-- 
-- 변경사항:
-- - 트리거 제거로 인해 사용되지 않는 handle_new_user 함수 삭제
-- ================================================================

BEGIN;

-- 사용하지 않는 함수 제거
DROP FUNCTION IF EXISTS handle_new_user();

-- 함수 제거 확인
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'handle_new_user'
  ) THEN
    RAISE EXCEPTION 'handle_new_user function still exists';
  ELSE
    RAISE NOTICE 'handle_new_user function successfully removed';
  END IF;
END $$;

COMMIT;

-- ================================================================
-- 현재 사용 중인 함수들 (참고용)
-- ================================================================
-- 1. setup_new_user: 기본 가계부 생성 (create_user_profile에서 호출)
-- 2. create_user_profile: 애플리케이션에서 RPC로 호출하여 프로필 생성