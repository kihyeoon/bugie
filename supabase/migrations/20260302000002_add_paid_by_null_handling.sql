-- ================================================================
-- 파일명: 20260302000002_add_paid_by_null_handling.sql
-- 목적: 회원 탈퇴 시 paid_by 컬럼 NULL 처리 추가
-- 작성일: 2026-03-02
--
-- 변경사항:
-- process_account_deletions_clean(), force_clean_user() 함수에
-- paid_by = NULL 처리 로직 추가
-- ================================================================

-- ================================================================
-- 1. process_account_deletions_clean() 재정의
-- ================================================================

CREATE OR REPLACE FUNCTION process_account_deletions_clean()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result RECORD;
  v_deleted_count INTEGER := 0;
  v_profiles_to_delete JSONB := '[]'::JSONB;
  v_email_hash TEXT;
  v_start_time TIMESTAMPTZ;
  v_end_time TIMESTAMPTZ;
BEGIN
  v_start_time := NOW();

  FOR v_result IN
    SELECT
      p.id,
      p.email,
      p.full_name,
      p.deleted_at
    FROM profiles p
    LEFT JOIN deleted_accounts da ON da.original_user_id = p.id
    WHERE p.deleted_at IS NOT NULL
      AND p.deleted_at <= NOW() - INTERVAL '30 days'
      AND p.email NOT LIKE 'deleted-%'
      AND (da.id IS NULL OR da.auth_deleted_at IS NULL)
    ORDER BY p.deleted_at ASC
    LIMIT 50
  LOOP
    BEGIN
      v_email_hash := encode(sha256(v_result.email::bytea), 'hex');

      INSERT INTO deleted_accounts (
        original_user_id,
        email_hash,
        deleted_at
      ) VALUES (
        v_result.id,
        v_email_hash,
        v_result.deleted_at
      ) ON CONFLICT (original_user_id) DO NOTHING;

      UPDATE transactions
      SET created_by = NULL
      WHERE created_by = v_result.id;

      UPDATE transactions
      SET paid_by = NULL
      WHERE paid_by = v_result.id;

      UPDATE budgets
      SET created_by = NULL
      WHERE created_by = v_result.id;

      UPDATE ledgers
      SET created_by = NULL
      WHERE created_by = v_result.id;

      DELETE FROM ledger_members
      WHERE user_id = v_result.id;

      DELETE FROM profiles
      WHERE id = v_result.id;

      v_profiles_to_delete := v_profiles_to_delete || jsonb_build_object(
        'user_id', v_result.id,
        'original_email', v_result.email,
        'deleted_at', v_result.deleted_at,
        'auth_can_delete', true
      );

      v_deleted_count := v_deleted_count + 1;

    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to process user %: %', v_result.id, SQLERRM;
    END;
  END LOOP;

  v_end_time := NOW();

  RETURN json_build_object(
    'success', true,
    'deleted_count', v_deleted_count,
    'profiles_to_delete', v_profiles_to_delete,
    'processed_at', v_start_time,
    'completed_at', v_end_time,
    'duration_ms', EXTRACT(MILLISECOND FROM (v_end_time - v_start_time))
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM,
      'error_detail', SQLSTATE,
      'processed_at', v_start_time
    );
END;
$$;

-- ================================================================
-- 2. force_clean_user() 재정의
-- ================================================================

CREATE OR REPLACE FUNCTION force_clean_user(target_user_id UUID)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    ) ON CONFLICT (original_user_id) DO NOTHING;
  END IF;

  UPDATE transactions
  SET created_by = NULL
  WHERE created_by = target_user_id;

  UPDATE transactions
  SET paid_by = NULL
  WHERE paid_by = target_user_id;

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
