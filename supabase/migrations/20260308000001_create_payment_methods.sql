-- 결제 수단(Payment Methods) 테이블 생성 및 transactions 연결

-- 1. payment_methods 테이블
CREATE TABLE payment_methods (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ledger_id uuid NOT NULL REFERENCES ledgers(id) ON DELETE CASCADE,
  owner_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  is_shared boolean NOT NULL DEFAULT false,
  name text NOT NULL,
  icon text DEFAULT 'credit-card',
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

-- 동일 소유자의 활성 결제 수단 이름 중복 방지
CREATE UNIQUE INDEX unique_active_payment_method_name
  ON payment_methods (ledger_id, owner_id, name)
  WHERE deleted_at IS NULL;

-- 공동 수단(owner_id = NULL)의 이름 중복 방지
-- PostgreSQL UNIQUE에서 NULL은 서로 다른 값으로 취급되므로 별도 partial index 필요
CREATE UNIQUE INDEX unique_active_shared_payment_method_name
  ON payment_methods (ledger_id, name)
  WHERE deleted_at IS NULL AND owner_id IS NULL;

-- 조회용 인덱스
CREATE INDEX idx_payment_methods_ledger
  ON payment_methods (ledger_id)
  WHERE deleted_at IS NULL;

-- 2. transactions에 payment_method_id 컬럼 추가
ALTER TABLE transactions
  ADD COLUMN payment_method_id uuid
    REFERENCES payment_methods(id) ON DELETE SET NULL;

CREATE INDEX idx_transactions_payment_method
  ON transactions (payment_method_id)
  WHERE deleted_at IS NULL;

-- 수입 거래에 결제 수단 지정 방지
ALTER TABLE transactions
  ADD CONSTRAINT check_payment_method_expense_only
    CHECK (type = 'expense' OR payment_method_id IS NULL);

-- 3. RLS 정책
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;

-- SELECT: 가계부 멤버만 조회 (soft-deleted 포함 — 과거 거래의 결제 수단 정보 보존)
CREATE POLICY "payment_methods_select_policy"
  ON payment_methods FOR SELECT
  USING (
    ledger_id IN (
      SELECT ledger_id FROM ledger_members
      WHERE user_id = auth.uid() AND deleted_at IS NULL
    )
  );

-- INSERT: 가계부 멤버면 누구 소유든 등록 가능
CREATE POLICY "payment_methods_insert_policy"
  ON payment_methods FOR INSERT
  WITH CHECK (
    ledger_id IN (
      SELECT ledger_id FROM ledger_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin', 'member')
        AND deleted_at IS NULL
    )
  );

-- UPDATE: owner/admin/member만 수정, soft delete된 행 접근 차단
CREATE POLICY "payment_methods_update_policy"
  ON payment_methods FOR UPDATE
  USING (
    deleted_at IS NULL
    AND ledger_id IN (
      SELECT ledger_id FROM ledger_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin', 'member')
        AND deleted_at IS NULL
    )
  )
  WITH CHECK (
    deleted_at IS NULL
    AND ledger_id IN (
      SELECT ledger_id FROM ledger_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin', 'member')
        AND deleted_at IS NULL
    )
  );

-- 4. Cross-ledger 참조 방지 트리거
CREATE OR REPLACE FUNCTION check_payment_method_ledger_match()
RETURNS trigger AS $$
BEGIN
  IF NEW.payment_method_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD.payment_method_id IS DISTINCT FROM NEW.payment_method_id)
  THEN
    IF NOT EXISTS (
      SELECT 1 FROM payment_methods
      WHERE id = NEW.payment_method_id
        AND ledger_id = NEW.ledger_id
        AND deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION '결제 수단이 해당 가계부에 속하지 않습니다.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_transaction_payment_method_match
  BEFORE INSERT OR UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION check_payment_method_ledger_match();

-- 5. ledger_id 변경 방지 트리거 (payment_methods + categories 공용)
CREATE OR REPLACE FUNCTION prevent_ledger_id_change()
RETURNS trigger AS $$
BEGIN
  IF OLD.ledger_id IS DISTINCT FROM NEW.ledger_id THEN
    RAISE EXCEPTION 'ledger_id cannot be changed';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_payment_method_ledger_change
  BEFORE UPDATE ON payment_methods
  FOR EACH ROW EXECUTE FUNCTION prevent_ledger_id_change();

-- 기존 categories 테이블에도 동일 취약점이 있으므로 함께 적용
CREATE TRIGGER prevent_category_ledger_change
  BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION prevent_ledger_id_change();

-- 6. Soft delete 함수
CREATE OR REPLACE FUNCTION soft_delete_payment_method(target_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM payment_methods pm
    JOIN ledger_members lm ON pm.ledger_id = lm.ledger_id
    WHERE pm.id = target_id
      AND pm.deleted_at IS NULL
      AND lm.user_id = auth.uid()
      AND lm.role IN ('owner', 'admin', 'member')
      AND lm.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Permission denied or payment method not found';
  END IF;

  UPDATE payment_methods
  SET deleted_at = now(),
      updated_at = now()
  WHERE id = target_id
    AND deleted_at IS NULL;

  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION soft_delete_payment_method(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION soft_delete_payment_method(uuid) TO authenticated;

COMMENT ON FUNCTION soft_delete_payment_method(uuid)
  IS '결제 수단을 소프트 삭제합니다. 해당 결제 수단을 참조하는 기존 거래는 영향받지 않습니다.';
