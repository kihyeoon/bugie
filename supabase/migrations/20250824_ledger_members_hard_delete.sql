-- ledger_members 테이블을 hard delete로 전환
-- 이유: soft delete + RLS + RETURNING 조합의 복잡성 해결
-- 해결: hard delete 사용으로 단순화

-- 기존 DELETE 정책 삭제
DROP POLICY IF EXISTS "ledger_members_delete_policy" ON ledger_members;

-- 새로운 DELETE 정책 생성
-- deleted_at 조건 제거 (hard delete이므로 불필요)
CREATE POLICY "ledger_members_delete_policy" ON ledger_members
FOR DELETE USING (
  -- 자신의 멤버십 삭제 가능 (owner 제외는 애플리케이션 레벨에서 처리)
  user_id = auth.uid() OR
  -- owner는 다른 멤버 삭제 가능
  ledger_id IN (
    SELECT id FROM ledgers 
    WHERE created_by = auth.uid() 
    AND deleted_at IS NULL
  )
);

-- 참고: ledger_members의 deleted_at 컬럼은 남겨둠 (향후 필요 시 사용)
-- 하지만 현재는 hard delete를 사용하므로 실제로 행이 삭제됨