-- 가계부 soft delete 함수 생성
-- RLS 정책과 Supabase의 RETURNING 절 충돌 문제 해결
-- SECURITY DEFINER로 RLS를 우회하여 soft delete 수행

CREATE OR REPLACE FUNCTION soft_delete_ledger(ledger_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 권한 확인: 가계부 생성자(owner)만 삭제 가능
  IF NOT EXISTS (
    SELECT 1 
    FROM ledgers
    WHERE id = ledger_id
    AND created_by = auth.uid()
    AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Permission denied to delete this ledger';
  END IF;

  -- Soft delete 수행
  UPDATE ledgers
  SET 
    deleted_at = now(),
    updated_at = now()
  WHERE id = ledger_id;

  RETURN true;
END;
$$;

-- 함수 설명 코멘트
COMMENT ON FUNCTION soft_delete_ledger(uuid) IS 
'Performs soft delete on a ledger. Only the creator (owner) can delete a ledger. 
This function bypasses RLS to avoid conflicts with Supabase''s automatic RETURNING clause.';