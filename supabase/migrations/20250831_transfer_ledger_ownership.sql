-- 소유자 권한 이전 RPC 함수
-- 현재 owner가 다른 멤버에게 owner 권한을 이전하는 기능
-- SECURITY DEFINER로 RLS 정책을 우회하여 안전하게 처리

CREATE OR REPLACE FUNCTION transfer_ledger_ownership(
  p_ledger_id UUID,
  p_new_owner_id UUID
) 
RETURNS void 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_owner_id UUID;
  v_new_owner_exists BOOLEAN;
  v_ledger_exists BOOLEAN;
BEGIN
  -- 1. 가계부 존재 확인
  SELECT EXISTS (
    SELECT 1 FROM ledgers 
    WHERE id = p_ledger_id 
    AND deleted_at IS NULL
  ) INTO v_ledger_exists;
  
  IF NOT v_ledger_exists THEN
    RAISE EXCEPTION '가계부를 찾을 수 없습니다.';
  END IF;

  -- 2. 현재 owner 확인
  SELECT user_id INTO v_current_owner_id
  FROM ledger_members
  WHERE ledger_id = p_ledger_id 
    AND role = 'owner'
    AND deleted_at IS NULL;
    
  IF v_current_owner_id IS NULL THEN
    RAISE EXCEPTION '현재 소유자를 찾을 수 없습니다.';
  END IF;
  
  -- 3. 현재 사용자가 owner인지 검증
  IF v_current_owner_id != auth.uid() THEN
    RAISE EXCEPTION '소유자만 권한을 이전할 수 있습니다.';
  END IF;
  
  -- 4. 자기 자신에게 이전하려는 경우 방지
  IF p_new_owner_id = v_current_owner_id THEN
    RAISE EXCEPTION '자기 자신에게는 권한을 이전할 수 없습니다.';
  END IF;
  
  -- 5. 새 owner가 해당 가계부의 멤버인지 확인
  SELECT EXISTS (
    SELECT 1 FROM ledger_members
    WHERE ledger_id = p_ledger_id 
      AND user_id = p_new_owner_id
      AND deleted_at IS NULL
  ) INTO v_new_owner_exists;
  
  IF NOT v_new_owner_exists THEN
    RAISE EXCEPTION '해당 사용자는 가계부 멤버가 아닙니다.';
  END IF;
  
  -- 6. 트랜잭션으로 권한 교체 (원자적 처리)
  -- 기존 owner를 member로 변경
  -- 주의: ledger_members 테이블에는 updated_at 컬럼이 없음
  UPDATE ledger_members 
  SET 
    role = 'member'
  WHERE ledger_id = p_ledger_id 
    AND user_id = v_current_owner_id
    AND deleted_at IS NULL;
    
  -- 새 owner로 변경
  UPDATE ledger_members 
  SET 
    role = 'owner'
  WHERE ledger_id = p_ledger_id 
    AND user_id = p_new_owner_id
    AND deleted_at IS NULL;
    
  -- ledgers 테이블의 updated_at 갱신 (이 테이블에는 updated_at이 있음)
  UPDATE ledgers
  SET updated_at = NOW()
  WHERE id = p_ledger_id;
    
  -- 7. 로그 기록 (선택사항, 향후 감사 추적용)
  -- INSERT INTO audit_logs (action, details, user_id, created_at)
  -- VALUES ('transfer_ownership', 
  --   jsonb_build_object(
  --     'ledger_id', p_ledger_id,
  --     'from_user_id', v_current_owner_id,
  --     'to_user_id', p_new_owner_id
  --   ),
  --   auth.uid(),
  --   NOW()
  -- );
  
  -- 성공
END;
$$;

-- 함수 설명 추가
COMMENT ON FUNCTION transfer_ledger_ownership(UUID, UUID) IS 
'가계부 소유자 권한을 다른 멤버에게 이전합니다. 현재 소유자만 실행할 수 있으며, 대상은 기존 멤버여야 합니다.';