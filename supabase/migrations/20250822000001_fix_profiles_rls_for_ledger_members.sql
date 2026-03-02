-- ================================================================
-- 파일명: 20250822_fix_profiles_rls_for_ledger_members.sql
-- 목적: profiles 테이블 RLS 정책 개선 - 같은 가계부 멤버끼리 프로필 조회 허용
-- 작성일: 2025-08-22
-- 
-- 문제점:
-- - 기존 profiles_policy는 자신의 프로필만 접근 가능 (auth.uid() = id)
-- - ledger_members와 조인 시 다른 멤버의 프로필이 null로 반환
-- - 멤버 초대 후 프로필 정보 조회 실패
--
-- 해결책:
-- - 자신의 프로필: 모든 작업 가능 (SELECT, INSERT, UPDATE, DELETE)
-- - 같은 가계부 멤버의 프로필: 조회만 가능 (SELECT)
-- ================================================================

-- 트랜잭션 시작
BEGIN;

-- 1. 기존 정책 삭제
DROP POLICY IF EXISTS "profiles_policy" ON profiles;

-- 2. 새로운 정책 생성
-- 2-1. 자신의 프로필에 대한 모든 권한
CREATE POLICY "profiles_own_all" ON profiles
FOR ALL 
USING (auth.uid() = id AND deleted_at IS NULL)
WITH CHECK (auth.uid() = id);

-- 2-2. 같은 가계부 멤버의 프로필 조회 권한
-- 성능을 위해 EXISTS 사용 (조인보다 효율적)
CREATE POLICY "profiles_ledger_members_select" ON profiles
FOR SELECT
USING (
  deleted_at IS NULL AND (
    -- 자신의 프로필
    auth.uid() = id
    OR
    -- 같은 가계부의 멤버
    EXISTS (
      SELECT 1 
      FROM ledger_members lm1
      INNER JOIN ledger_members lm2 ON lm1.ledger_id = lm2.ledger_id
      WHERE lm1.user_id = auth.uid() 
      AND lm2.user_id = profiles.id
      AND lm1.deleted_at IS NULL
      AND lm2.deleted_at IS NULL
    )
  )
);

-- 3. 정책이 제대로 생성되었는지 확인
DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public' 
  AND tablename = 'profiles'
  AND policyname IN ('profiles_own_all', 'profiles_ledger_members_select');
  
  IF policy_count != 2 THEN
    RAISE EXCEPTION 'RLS 정책 생성 실패';
  END IF;
END $$;

-- 4. 테스트를 위한 검증 쿼리 (주석 처리됨, 필요시 실행)
-- 같은 가계부 멤버의 프로필을 조회할 수 있는지 테스트
/*
SELECT 
  l.id as ledger_id,
  l.name as ledger_name,
  lm.user_id,
  lm.role,
  p.email,
  p.full_name
FROM ledgers l
JOIN ledger_members lm ON l.id = lm.ledger_id
LEFT JOIN profiles p ON lm.user_id = p.id
WHERE l.id IN (
  SELECT ledger_id 
  FROM ledger_members 
  WHERE user_id = auth.uid()
)
AND lm.deleted_at IS NULL
AND l.deleted_at IS NULL;
*/

-- 커밋
COMMIT;

-- ================================================================
-- 롤백 스크립트 (필요시 사용)
-- ================================================================
/*
BEGIN;

-- 새로운 정책 삭제
DROP POLICY IF EXISTS "profiles_own_all" ON profiles;
DROP POLICY IF EXISTS "profiles_ledger_members_select" ON profiles;

-- 기존 정책 복원
CREATE POLICY "profiles_policy" ON profiles
FOR ALL USING (auth.uid() = id AND deleted_at IS NULL);

COMMIT;
*/