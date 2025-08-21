-- Soft Delete Transaction Function
-- 거래 삭제 시 RLS 정책을 우회하기 위한 함수
-- SECURITY DEFINER로 실행되어 RLS를 우회하면서도 권한 검증 수행

CREATE OR REPLACE FUNCTION soft_delete_transaction(transaction_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 권한 확인: 사용자가 해당 거래가 속한 가계부의 멤버이고 적절한 권한이 있는지 확인
  IF NOT EXISTS (
    SELECT 1 
    FROM transactions t
    JOIN ledger_members lm ON t.ledger_id = lm.ledger_id
    WHERE t.id = transaction_id
    AND lm.user_id = auth.uid()
    AND lm.role IN ('owner', 'admin', 'member')  -- viewer는 삭제 불가
    AND lm.deleted_at IS NULL
    AND t.deleted_at IS NULL  -- 이미 삭제된 거래는 다시 삭제 불가
  ) THEN
    RAISE EXCEPTION 'Permission denied to delete this transaction';
  END IF;

  -- Soft delete 수행
  UPDATE transactions
  SET 
    deleted_at = NOW(),
    updated_at = NOW()
  WHERE id = transaction_id;

  RETURN TRUE;
END;
$$;

-- 함수 설명 추가
COMMENT ON FUNCTION soft_delete_transaction(uuid) IS 
'거래를 소프트 삭제합니다. RLS 정책을 우회하면서도 권한을 검증합니다.';