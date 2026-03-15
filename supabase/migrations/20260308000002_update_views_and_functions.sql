-- 결제 수단 추가에 따른 뷰/함수 업데이트

-- 1. active_transactions 뷰 재생성 (payment_method 컬럼 추가)
DROP VIEW IF EXISTS active_transactions CASCADE;

CREATE VIEW active_transactions AS
SELECT
  t.id,
  t.ledger_id,
  t.category_id,
  t.created_by,
  t.amount,
  t.type,
  t.title,
  t.description,
  t.transaction_date,
  t.created_at,
  t.updated_at,
  t.deleted_at,
  t.paid_by,
  cd.name     AS category_name,
  cd.color    AS category_color,
  cd.icon     AS category_icon,
  cd.source_type AS category_source,
  l.name      AS ledger_name,
  p.full_name AS created_by_name,
  p2.full_name AS paid_by_name,
  t.payment_method_id,
  pm.name     AS payment_method_name,
  pm.icon     AS payment_method_icon,
  pm.is_shared AS payment_method_is_shared
FROM transactions t
  JOIN category_details cd ON t.category_id = cd.id
  JOIN ledgers l ON t.ledger_id = l.id
  LEFT JOIN profiles p ON t.created_by = p.id
  LEFT JOIN profiles p2 ON t.paid_by = p2.id
  LEFT JOIN payment_methods pm ON t.payment_method_id = pm.id
WHERE t.deleted_at IS NULL
  AND l.deleted_at IS NULL;

ALTER VIEW active_transactions SET (security_invoker = on);

COMMENT ON VIEW active_transactions
  IS '활성 거래 목록 (결제 수단 정보 포함)';

-- 2. cleanup_old_deleted_data에 payment_methods 추가
CREATE OR REPLACE FUNCTION cleanup_old_deleted_data()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM transactions
  WHERE deleted_at IS NOT NULL
    AND deleted_at < now() - INTERVAL '30 days';

  DELETE FROM budgets
  WHERE deleted_at IS NOT NULL
    AND deleted_at < now() - INTERVAL '30 days';

  DELETE FROM categories
  WHERE deleted_at IS NOT NULL
    AND deleted_at < now() - INTERVAL '30 days';

  -- payment_methods: transactions 뒤, ledgers 앞 (FK 순서)
  DELETE FROM payment_methods
  WHERE deleted_at IS NOT NULL
    AND deleted_at < now() - INTERVAL '30 days';

  DELETE FROM ledger_members
  WHERE deleted_at IS NOT NULL
    AND deleted_at < now() - INTERVAL '30 days';

  DELETE FROM ledgers
  WHERE deleted_at IS NOT NULL
    AND deleted_at < now() - INTERVAL '30 days';
END;
$$;

-- 3. force_clean_user에 payment_methods.owner_id NULL 처리 추가
CREATE OR REPLACE FUNCTION force_clean_user(target_user_id uuid)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_email TEXT;
  v_profile_deleted BOOLEAN := false;
  v_auth_deleted BOOLEAN := false;
BEGIN
  SELECT email INTO v_email FROM profiles WHERE id = target_user_id;

  IF v_email IS NULL THEN
    SELECT email INTO v_email FROM auth.users WHERE id = target_user_id;
    IF v_email IS NULL THEN
      RETURN json_build_object(
        'success', false,
        'error', 'User not found in profiles or auth.users'
      );
    END IF;
  END IF;

  IF v_email IS NOT NULL AND NOT v_email LIKE 'deleted-%' THEN
    INSERT INTO deleted_accounts (
      original_user_id,
      email_hash,
      deleted_at,
      anonymized_at
    ) VALUES (
      target_user_id,
      encode(sha256(v_email::bytea), 'hex'),
      NOW(),
      NOW()
    ) ON CONFLICT (original_user_id) DO UPDATE
      SET anonymized_at = NOW();
  END IF;

  UPDATE transactions
  SET created_by = NULL
  WHERE created_by = target_user_id;

  UPDATE transactions
  SET paid_by = NULL
  WHERE paid_by = target_user_id;

  -- payment_methods owner_id NULL 처리 (paid_by 직후)
  UPDATE payment_methods
  SET owner_id = NULL
  WHERE owner_id = target_user_id;

  UPDATE budgets
  SET created_by = NULL
  WHERE created_by = target_user_id;

  UPDATE ledgers
  SET created_by = NULL
  WHERE created_by = target_user_id;

  DELETE FROM ledger_members
  WHERE user_id = target_user_id;

  DELETE FROM profiles
  WHERE id = target_user_id;
  v_profile_deleted := FOUND;

  BEGIN
    DELETE FROM auth.users
    WHERE id = target_user_id;
    v_auth_deleted := FOUND;

    IF v_auth_deleted THEN
      UPDATE deleted_accounts
      SET auth_deleted_at = NOW()
      WHERE original_user_id = target_user_id;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_auth_deleted := false;
  END;

  RETURN json_build_object(
    'success', true,
    'email', v_email,
    'profile_deleted', v_profile_deleted,
    'auth_deleted', v_auth_deleted,
    'message', 'User cleaned successfully'
  );

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

COMMENT ON FUNCTION force_clean_user(uuid)
  IS '특정 사용자를 강제로 삭제하는 관리자용 함수입니다.
- 테스트 및 긴급 상황용으로만 사용하세요
- 30일 대기 없이 즉시 삭제 처리
- 파라미터: target_user_id (삭제할 사용자 UUID)
- 반환값: {success, email, profile_deleted, auth_deleted, message}';
