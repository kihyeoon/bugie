-- ================================================================
-- 파일명: 20250827_05_cleanup_unused_functions.sql
-- 목적: 사용하지 않는 회원 탈퇴 관련 함수 정리
-- 작성일: 2025-08-27
--
-- 변경사항:
-- 1. 익명화 전략 함수 제거 (process_account_deletions)
-- 2. 사용 중인 함수들에 명확한 설명 추가
-- ================================================================

BEGIN;

-- ================================================================
-- 1. 사용하지 않는 익명화 함수 제거
-- ================================================================

-- 초기 설계에서 사용했던 익명화 함수 제거
-- 완전 삭제 전략으로 변경되어 더 이상 필요 없음
DROP FUNCTION IF EXISTS process_account_deletions();

-- ================================================================
-- 2. 현재 사용 중인 함수들에 설명 추가
-- ================================================================

-- 메인 회원 탈퇴 처리 함수
COMMENT ON FUNCTION process_account_deletions_clean() IS 
'30일 경과한 탈퇴 계정을 완전 삭제하는 메인 함수입니다.
- GitHub Actions에서 매일 실행됩니다
- profiles 테이블에서 완전 삭제
- 관련 테이블의 created_by를 NULL로 설정하여 데이터는 보존
- 배치 크기: 50개로 제한
- 반환값: {success, deleted_count, profiles_to_delete[], duration_ms}';

-- 특정 사용자 강제 삭제 함수
COMMENT ON FUNCTION force_clean_user(UUID) IS 
'특정 사용자를 강제로 삭제하는 관리자용 함수입니다.
- 테스트 및 긴급 상황용으로만 사용하세요
- 30일 대기 없이 즉시 삭제 처리
- 파라미터: target_user_id (삭제할 사용자 UUID)
- 반환값: {success, email, profile_deleted, auth_deleted, message}
⚠️ 주의: 프로덕션에서는 신중하게 사용하세요';

-- ================================================================
-- 3. 검증
-- ================================================================

DO $$
BEGIN
  -- 익명화 함수가 삭제되었는지 확인
  IF EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'process_account_deletions'
  ) THEN
    RAISE EXCEPTION 'process_account_deletions function still exists';
  END IF;
  
  -- 필요한 함수들이 존재하는지 확인
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'process_account_deletions_clean'
  ) THEN
    RAISE EXCEPTION 'process_account_deletions_clean function not found';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'force_clean_user'
  ) THEN
    RAISE EXCEPTION 'force_clean_user function not found';
  END IF;
  
  RAISE NOTICE 'Function cleanup completed successfully';
END $$;

COMMIT;

-- ================================================================
-- 사용 가이드
-- ================================================================
/*
현재 사용 가능한 회원 탈퇴 관련 함수:

1. process_account_deletions_clean()
   - 매일 자동 실행되는 메인 함수
   - GitHub Actions에서 호출
   
   사용 예:
   SELECT process_account_deletions_clean();

2. force_clean_user(UUID)
   - 특정 사용자 즉시 삭제
   - 테스트 또는 긴급 상황용
   
   사용 예:
   SELECT force_clean_user('user-uuid-here');

삭제된 함수:
- process_account_deletions() - 익명화 전략 함수 (더 이상 사용 안 함)
*/