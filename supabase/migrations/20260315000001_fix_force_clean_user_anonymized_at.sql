-- fix: force_clean_user 함수에서 존재하지 않는 anonymized_at 컬럼 참조 제거
-- 원인: 20250828000001에서 deleted_accounts.anonymized_at 컬럼을 DROP했으나
--       force_clean_user 함수는 업데이트하지 않아 런타임 에러 발생

CREATE OR REPLACE FUNCTION force_clean_user(target_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
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
      deleted_at
    ) VALUES (
      target_user_id,
      encode(sha256(v_email::bytea), 'hex'),
      NOW()
    ) ON CONFLICT (original_user_id) DO UPDATE
      SET email_hash = EXCLUDED.email_hash;
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
