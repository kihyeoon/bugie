

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgjwt" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."budget_period" AS ENUM (
    'monthly',
    'yearly'
);


ALTER TYPE "public"."budget_period" OWNER TO "postgres";


CREATE TYPE "public"."category_type" AS ENUM (
    'income',
    'expense'
);


ALTER TYPE "public"."category_type" OWNER TO "postgres";


CREATE TYPE "public"."member_role" AS ENUM (
    'owner',
    'admin',
    'member',
    'viewer'
);


ALTER TYPE "public"."member_role" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."activate_default_categories"("target_ledger_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  INSERT INTO categories (ledger_id, template_id, type)
  SELECT target_ledger_id, ct.id, ct.type
  FROM category_templates ct
  ON CONFLICT (ledger_id, template_id) DO NOTHING;
END;
$$;


ALTER FUNCTION "public"."activate_default_categories"("target_ledger_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_custom_category"("target_ledger_id" "uuid", "category_name" "text", "category_type" "public"."category_type", "category_color" "text" DEFAULT '#6B7280'::"text", "category_icon" "text" DEFAULT 'pricetag'::"text", "category_sort_order" integer DEFAULT 999) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  category_id uuid;
BEGIN
  INSERT INTO categories (ledger_id, name, type, color, icon, sort_order)
  VALUES (target_ledger_id, category_name, category_type, category_color, category_icon, category_sort_order)
  RETURNING id INTO category_id;

  RETURN category_id;
END;
$$;


ALTER FUNCTION "public"."add_custom_category"("target_ledger_id" "uuid", "category_name" "text", "category_type" "public"."category_type", "category_color" "text", "category_icon" "text", "category_sort_order" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_payment_method_ledger_match"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."check_payment_method_ledger_match"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_transaction_category_type"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  cat_type category_type;
BEGIN
  -- Get category type from category_details view
  SELECT cd.type INTO cat_type
  FROM category_details cd
  WHERE cd.id = new.category_id;

  IF cat_type != new.type THEN
    RAISE EXCEPTION '거래 타입(%)과 카테고리 타입(%)이 일치하지 않습니다.', new.type, cat_type;
  END IF;

  RETURN new;
END;
$$;


ALTER FUNCTION "public"."check_transaction_category_type"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_old_deleted_data"() RETURNS "void"
    LANGUAGE "plpgsql"
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


ALTER FUNCTION "public"."cleanup_old_deleted_data"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_user_profile"("p_user_id" "uuid", "p_email" "text", "p_full_name" "text" DEFAULT NULL::"text", "p_avatar_url" "text" DEFAULT NULL::"text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- 이미 존재하는지 확인
  IF EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id) THEN
    RETURN TRUE; -- 이미 존재하면 성공으로 처리
  END IF;
  
  -- 프로필 생성
  INSERT INTO profiles (
    id, 
    email, 
    full_name, 
    avatar_url,
    currency,
    timezone
  )
  VALUES (
    p_user_id,
    p_email,
    COALESCE(p_full_name, split_part(p_email, '@', 1)),
    p_avatar_url,
    'KRW',
    'Asia/Seoul'
  )
  ON CONFLICT (id) DO NOTHING;
  
  -- 기본 가계부 생성
  IF EXISTS (
    SELECT 1 FROM pg_proc p 
    JOIN pg_namespace n ON p.pronamespace = n.oid 
    WHERE n.nspname = 'public' AND p.proname = 'setup_new_user'
  ) THEN
    PERFORM setup_new_user(
      p_user_id,
      p_email,
      COALESCE(p_full_name, split_part(p_email, '@', 1))
    );
  END IF;
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error creating profile for user %: %', p_user_id, SQLERRM;
    RETURN FALSE;
END;
$$;


ALTER FUNCTION "public"."create_user_profile"("p_user_id" "uuid", "p_email" "text", "p_full_name" "text", "p_avatar_url" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."create_user_profile"("p_user_id" "uuid", "p_email" "text", "p_full_name" "text", "p_avatar_url" "text") IS '애플리케이션에서 호출하여 사용자 프로필을 생성하는 함수.
트리거 대신 명시적으로 호출하여 사용.';



CREATE OR REPLACE FUNCTION "public"."force_clean_user"("target_user_id" "uuid") RETURNS "json"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."force_clean_user"("target_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."force_clean_user"("target_user_id" "uuid") IS '특정 사용자를 강제로 삭제하는 관리자용 함수입니다.
- 테스트 및 긴급 상황용으로만 사용하세요
- 30일 대기 없이 즉시 삭제 처리
- 파라미터: target_user_id (삭제할 사용자 UUID)
- 반환값: {success, email, profile_deleted, auth_deleted, message}';



CREATE OR REPLACE FUNCTION "public"."get_ledger_monthly_stats"("target_ledger_id" "uuid", "target_year" integer, "target_month" integer) RETURNS TABLE("total_income" numeric, "total_expense" numeric, "net_amount" numeric, "transaction_count" bigint, "budget_total" numeric, "budget_remaining" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END), 0) AS total_income,
    COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0) AS total_expense,
    COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE -t.amount END), 0) AS net_amount,
    COUNT(t.*)::bigint AS transaction_count,
    COALESCE(SUM(b.amount), 0) AS budget_total,
    COALESCE(SUM(b.amount), 0) - COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0) AS budget_remaining
  FROM transactions t
  FULL OUTER JOIN budgets b ON b.ledger_id = target_ledger_id
    AND b.year = target_year
    AND (b.month = target_month OR b.period = 'yearly')
    AND b.deleted_at IS NULL
  WHERE (t.ledger_id = target_ledger_id OR t.ledger_id IS NULL)
    AND (t.deleted_at IS NULL OR t.deleted_at IS NULL)
    AND (
      t.id IS NULL OR (
        EXTRACT(year FROM t.transaction_date) = target_year
        AND EXTRACT(month FROM t.transaction_date) = target_month
      )
    );
END;
$$;


ALTER FUNCTION "public"."get_ledger_monthly_stats"("target_ledger_id" "uuid", "target_year" integer, "target_month" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_ledgers"() RETURNS TABLE("id" "uuid", "name" "text", "description" "text", "currency" "text", "created_by" "uuid", "role" "public"."member_role", "created_at" timestamp with time zone, "updated_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        l.id,
        l.name,
        l.description,
        l.currency,
        l.created_by,
        lm.role,
        l.created_at,
        l.updated_at
    FROM ledgers l
    INNER JOIN ledger_members lm ON l.id = lm.ledger_id
    WHERE lm.user_id = auth.uid()
    AND l.deleted_at IS NULL
    AND lm.deleted_at IS NULL;
END;
$$;


ALTER FUNCTION "public"."get_user_ledgers"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."initialize_category_templates"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  INSERT INTO category_templates (name, type, color, icon, sort_order) VALUES
  -- Expense categories
  ('식비', 'expense', '#EF4444', 'utensils', 1),
  ('교통비', 'expense', '#3B82F6', 'car', 2),
  ('쇼핑', 'expense', '#8B5CF6', 'shopping-bag', 3),
  ('문화/여가', 'expense', '#06B6D4', 'film', 4),
  ('의료/건강', 'expense', '#10B981', 'heart', 5),
  ('주거/통신', 'expense', '#F59E0B', 'home', 6),
  ('교육', 'expense', '#8B5A2B', 'book', 7),
  ('기타지출', 'expense', '#6B7280', 'more-horizontal', 99),
  
  -- Income categories
  ('급여', 'income', '#059669', 'briefcase', 1),
  ('사업소득', 'income', '#DC2626', 'trending-up', 2),
  ('투자수익', 'income', '#7C3AED', 'bar-chart', 3),
  ('용돈/선물', 'income', '#0891B2', 'gift', 4),
  ('기타수입', 'income', '#6B7280', 'plus-circle', 99)
  ON CONFLICT (name, type) DO NOTHING;
END;
$$;


ALTER FUNCTION "public"."initialize_category_templates"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."invite_member_to_ledger"("target_ledger_id" "uuid", "target_user_email" "text", "member_role" "public"."member_role" DEFAULT 'member'::"public"."member_role") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  target_user_id uuid;
  current_user_role member_role;
BEGIN
  -- Check if current user has permission to invite
  SELECT role INTO current_user_role
  FROM ledger_members
  WHERE ledger_id = target_ledger_id
    AND user_id = auth.uid()
    AND deleted_at IS NULL;

  IF current_user_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION '권한이 없습니다.';
  END IF;

  -- Find target user ID
  SELECT id INTO target_user_id
  FROM profiles
  WHERE email = target_user_email AND deleted_at IS NULL;

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION '사용자를 찾을 수 없습니다.';
  END IF;

  -- Add member
  INSERT INTO ledger_members (ledger_id, user_id, role)
  VALUES (target_ledger_id, target_user_id, member_role)
  ON CONFLICT (ledger_id, user_id) DO UPDATE SET
    role = excluded.role,
    deleted_at = NULL;

  RETURN true;
END;
$$;


ALTER FUNCTION "public"."invite_member_to_ledger"("target_ledger_id" "uuid", "target_user_email" "text", "member_role" "public"."member_role") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_ledger_id_change"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF OLD.ledger_id IS DISTINCT FROM NEW.ledger_id THEN
    RAISE EXCEPTION 'ledger_id cannot be changed';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."prevent_ledger_id_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_account_deletions"() RETURNS "json"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_deleted_count INTEGER := 0;
  v_profiles_to_delete jsonb := '[]'::jsonb;
  v_result RECORD;
  v_start_time TIMESTAMP := NOW();
  v_end_time TIMESTAMP;
BEGIN
  -- 중복 실행 방지를 위한 advisory lock
  IF NOT pg_try_advisory_xact_lock(2147483647) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Another deletion process is already running'
    );
  END IF;

  -- 30일 경과한 탈퇴 계정 처리
  FOR v_result IN 
    SELECT id, email, deleted_at
    FROM profiles
    WHERE deleted_at IS NOT NULL
      AND deleted_at <= NOW() - INTERVAL '30 days'
      AND email NOT LIKE 'deleted-%'  -- 이미 처리된 것 제외
    ORDER BY deleted_at ASC
    LIMIT 50
  LOOP
    BEGIN
      -- 1. 이메일 해시 저장 (재가입 체크용)
      INSERT INTO deleted_accounts (
        original_user_id,
        email_hash,
        deleted_at
      ) VALUES (
        v_result.id,
        encode(sha256(v_result.email::bytea), 'hex'),
        v_result.deleted_at
      ) ON CONFLICT (original_user_id) 
      DO UPDATE SET 
        email_hash = EXCLUDED.email_hash;
      
      -- 2. profiles 삭제 
      -- CASCADE: ledger_members 자동 삭제
      -- SET NULL: transactions, budgets, ledgers의 created_by 자동 NULL 처리
      DELETE FROM profiles WHERE id = v_result.id;
      
      -- 3. auth.users 삭제 대상 목록에 추가
      v_profiles_to_delete := v_profiles_to_delete || jsonb_build_object(
        'user_id', v_result.id,
        'original_email', v_result.email,
        'deleted_at', v_result.deleted_at
      );
      
      v_deleted_count := v_deleted_count + 1;
      
    EXCEPTION WHEN OTHERS THEN
      -- 개별 사용자 처리 실패 시 로그만 남기고 계속 진행
      RAISE WARNING 'Failed to process user %: %', v_result.id, SQLERRM;
    END;
  END LOOP;
  
  v_end_time := NOW();
  
  -- 처리 결과 반환
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
      'error_detail', SQLSTATE
    );
END;
$$;


ALTER FUNCTION "public"."process_account_deletions"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."process_account_deletions"() IS '30일 경과한 탈퇴 계정을 처리하는 최적화된 함수.
ON DELETE SET NULL을 활용하여 자동으로 참조를 NULL 처리합니다.
새로운 테이블이 추가되어도 외래키만 적절히 설정하면 자동으로 작동합니다.';



CREATE OR REPLACE FUNCTION "public"."process_account_deletions_clean"() RETURNS "json"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."process_account_deletions_clean"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."restore_deleted_account"("target_user_id" "uuid") RETURNS "json"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_deleted_at TIMESTAMP;
  v_days_since_deletion INTEGER;
BEGIN
  -- 프로필의 삭제 상태 확인
  SELECT deleted_at INTO v_deleted_at
  FROM profiles
  WHERE id = target_user_id;
  
  -- 계정이 삭제되지 않았거나 존재하지 않는 경우
  IF v_deleted_at IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Account is not deleted or does not exist'
    );
  END IF;
  
  -- 삭제 후 경과 일수 계산
  v_days_since_deletion := EXTRACT(DAY FROM NOW() - v_deleted_at)::INTEGER;
  
  -- 유예 기간(30일) 초과 확인
  IF v_days_since_deletion > 30 THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Recovery period expired',
      'days_since_deletion', v_days_since_deletion
    );
  END IF;
  
  -- 계정 복구 처리
  UPDATE profiles
  SET 
    deleted_at = NULL,
    updated_at = NOW()
  WHERE id = target_user_id;
  
  -- 복구 성공 결과 반환
  RETURN json_build_object(
    'success', true,
    'message', 'Account successfully restored',
    'days_since_deletion', v_days_since_deletion
  );
END;
$$;


ALTER FUNCTION "public"."restore_deleted_account"("target_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."restore_deleted_account"("target_user_id" "uuid") IS '탈퇴 후 30일 이내에 호출하면 계정을 자동으로 복구합니다. 
복구 성공 여부와 세부 정보를 JSON으로 반환합니다.';



CREATE OR REPLACE FUNCTION "public"."set_budget"("target_ledger_id" "uuid", "target_category_id" "uuid", "budget_amount" numeric, "budget_year" integer, "budget_month" integer DEFAULT NULL::integer) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  budget_id uuid;
  budget_period budget_period;
BEGIN
  -- Determine budget period
  budget_period := CASE WHEN budget_month IS NULL THEN 'yearly' ELSE 'monthly' END;

  -- Set budget (upsert)
  INSERT INTO budgets (ledger_id, category_id, amount, period, year, month, created_by)
  VALUES (target_ledger_id, target_category_id, budget_amount, budget_period, budget_year, budget_month, auth.uid())
  ON CONFLICT (ledger_id, category_id, year, month) DO UPDATE SET
    amount = excluded.amount,
    updated_at = now(),
    deleted_at = NULL
  RETURNING id INTO budget_id;

  RETURN budget_id;
END;
$$;


ALTER FUNCTION "public"."set_budget"("target_ledger_id" "uuid", "target_category_id" "uuid", "budget_amount" numeric, "budget_year" integer, "budget_month" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."setup_new_user"("user_uuid" "uuid", "user_email" "text", "user_name" "text") RETURNS "uuid"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  new_ledger_id uuid;
BEGIN
  -- Create or update profile
  INSERT INTO profiles (id, email, full_name)
  VALUES (user_uuid, user_email, user_name)
  ON CONFLICT (id) DO UPDATE SET
    email = excluded.email,
    full_name = excluded.full_name;

  -- Create default ledger
  INSERT INTO ledgers (name, description, created_by)
  VALUES (user_name || '의 가계부', '개인 가계부입니다.', user_uuid)
  RETURNING id INTO new_ledger_id;

  -- Add user as owner
  INSERT INTO ledger_members (ledger_id, user_id, role)
  VALUES (new_ledger_id, user_uuid, 'owner');

  -- Activate default categories
  PERFORM activate_default_categories(new_ledger_id);

  RETURN new_ledger_id;
END;
$$;


ALTER FUNCTION "public"."setup_new_user"("user_uuid" "uuid", "user_email" "text", "user_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."soft_delete_category"("category_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Check if user has permission to delete this category
  IF NOT EXISTS (
    SELECT 1 
    FROM categories c
    JOIN ledger_members lm ON c.ledger_id = lm.ledger_id
    WHERE c.id = category_id
    AND lm.user_id = auth.uid()
    AND lm.role IN ('owner', 'admin', 'member')
    AND lm.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Permission denied to delete this category';
  END IF;

  -- Perform soft delete
  UPDATE categories
  SET 
    is_active = false,
    deleted_at = NOW(),
    updated_at = NOW()
  WHERE id = category_id;

  RETURN true;
END;
$$;


ALTER FUNCTION "public"."soft_delete_category"("category_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."soft_delete_category"("category_id" "uuid") IS 'Soft delete a category with proper permission checks';



CREATE OR REPLACE FUNCTION "public"."soft_delete_ledger"("ledger_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."soft_delete_ledger"("ledger_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."soft_delete_ledger"("ledger_id" "uuid") IS 'Performs soft delete on a ledger. Only the creator (owner) can delete a ledger. 
This function bypasses RLS to avoid conflicts with Supabase''s automatic RETURNING clause.';



CREATE OR REPLACE FUNCTION "public"."soft_delete_payment_method"("target_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."soft_delete_payment_method"("target_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."soft_delete_payment_method"("target_id" "uuid") IS '결제 수단을 소프트 삭제합니다. 해당 결제 수단을 참조하는 기존 거래는 영향받지 않습니다.';



CREATE OR REPLACE FUNCTION "public"."soft_delete_profile"() RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- 인증 확인
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  -- 이미 삭제된 프로필인지 확인
  IF EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND deleted_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Profile already deleted';
  END IF;
  
  -- Soft delete 수행 (RETURNING 없이)
  UPDATE profiles
  SET 
    deleted_at = NOW(),
    updated_at = NOW()
  WHERE id = auth.uid()
  AND deleted_at IS NULL;  -- 중복 삭제 방지
  
  -- 업데이트된 행이 없으면 오류
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found or already deleted';
  END IF;
  
  RETURN true;
END;
$$;


ALTER FUNCTION "public"."soft_delete_profile"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."soft_delete_profile"() IS '프로필 soft delete를 수행하는 RPC 함수. 
RLS 정책과 RETURNING 절의 충돌을 회피하기 위해 SECURITY DEFINER로 실행됩니다.
자신의 프로필만 삭제할 수 있으며, 이미 삭제된 프로필은 다시 삭제할 수 없습니다.';



CREATE OR REPLACE FUNCTION "public"."soft_delete_transaction"("transaction_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."soft_delete_transaction"("transaction_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."soft_delete_transaction"("transaction_id" "uuid") IS '거래를 소프트 삭제합니다. RLS 정책을 우회하면서도 권한을 검증합니다.';



CREATE OR REPLACE FUNCTION "public"."transfer_ledger_ownership"("p_ledger_id" "uuid", "p_new_owner_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."transfer_ledger_ownership"("p_ledger_id" "uuid", "p_new_owner_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."transfer_ledger_ownership"("p_ledger_id" "uuid", "p_new_owner_id" "uuid") IS '가계부 소유자 권한을 다른 멤버에게 이전합니다. 현재 소유자만 실행할 수 있으며, 대상은 기존 멤버여야 합니다.';


SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ledger_id" "uuid" NOT NULL,
    "template_id" "uuid",
    "name" "text",
    "type" "public"."category_type" NOT NULL,
    "color" "text" DEFAULT '#6B7280'::"text",
    "icon" "text" DEFAULT 'pricetag'::"text",
    "sort_order" integer DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone,
    CONSTRAINT "check_category_source" CHECK (((("template_id" IS NOT NULL) AND ("name" IS NULL)) OR (("template_id" IS NULL) AND ("name" IS NOT NULL))))
);


ALTER TABLE "public"."categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."category_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "type" "public"."category_type" NOT NULL,
    "color" "text" DEFAULT '#3B82F6'::"text",
    "icon" "text" DEFAULT 'receipt'::"text",
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."category_templates" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."category_details" WITH ("security_invoker"='on') AS
 SELECT "c"."id",
    "c"."ledger_id",
    "c"."template_id",
    COALESCE("ct"."name", "c"."name") AS "name",
    COALESCE("ct"."color", "c"."color") AS "color",
    COALESCE("ct"."icon", "c"."icon") AS "icon",
    COALESCE("c"."type", "ct"."type") AS "type",
    "c"."is_active",
    "c"."created_at",
    "c"."updated_at",
        CASE
            WHEN ("c"."template_id" IS NOT NULL) THEN 'template'::"text"
            ELSE 'custom'::"text"
        END AS "source_type",
        CASE
            WHEN ("c"."template_id" IS NOT NULL) THEN "ct"."sort_order"
            ELSE "c"."sort_order"
        END AS "sort_order"
   FROM ("public"."categories" "c"
     LEFT JOIN "public"."category_templates" "ct" ON (("c"."template_id" = "ct"."id")))
  WHERE (("c"."deleted_at" IS NULL) AND ("c"."is_active" = true));


ALTER TABLE "public"."category_details" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ledgers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "currency" "text" DEFAULT 'KRW'::"text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone
);


ALTER TABLE "public"."ledgers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payment_methods" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ledger_id" "uuid" NOT NULL,
    "owner_id" "uuid",
    "is_shared" boolean DEFAULT false NOT NULL,
    "name" "text" NOT NULL,
    "icon" "text" DEFAULT 'credit-card'::"text",
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone
);


ALTER TABLE "public"."payment_methods" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text",
    "full_name" "text",
    "avatar_url" "text",
    "currency" "text" DEFAULT 'KRW'::"text",
    "timezone" "text" DEFAULT 'Asia/Seoul'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ledger_id" "uuid" NOT NULL,
    "category_id" "uuid" NOT NULL,
    "created_by" "uuid",
    "amount" numeric(15,2) NOT NULL,
    "type" "public"."category_type" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "transaction_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone,
    "paid_by" "uuid",
    "payment_method_id" "uuid",
    CONSTRAINT "check_payment_method_expense_only" CHECK ((("type" = 'expense'::"public"."category_type") OR ("payment_method_id" IS NULL))),
    CONSTRAINT "transactions_amount_check" CHECK (("amount" > (0)::numeric))
);


ALTER TABLE "public"."transactions" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."active_transactions" WITH ("security_invoker"='on') AS
 SELECT "t"."id",
    "t"."ledger_id",
    "t"."category_id",
    "t"."created_by",
    "t"."amount",
    "t"."type",
    "t"."title",
    "t"."description",
    "t"."transaction_date",
    "t"."created_at",
    "t"."updated_at",
    "t"."deleted_at",
    "t"."paid_by",
    "cd"."name" AS "category_name",
    "cd"."color" AS "category_color",
    "cd"."icon" AS "category_icon",
    "cd"."source_type" AS "category_source",
    "l"."name" AS "ledger_name",
    "p"."full_name" AS "created_by_name",
    "p2"."full_name" AS "paid_by_name",
    "t"."payment_method_id",
    "pm"."name" AS "payment_method_name",
    "pm"."icon" AS "payment_method_icon",
    "pm"."is_shared" AS "payment_method_is_shared"
   FROM ((((("public"."transactions" "t"
     JOIN "public"."category_details" "cd" ON (("t"."category_id" = "cd"."id")))
     JOIN "public"."ledgers" "l" ON (("t"."ledger_id" = "l"."id")))
     LEFT JOIN "public"."profiles" "p" ON (("t"."created_by" = "p"."id")))
     LEFT JOIN "public"."profiles" "p2" ON (("t"."paid_by" = "p2"."id")))
     LEFT JOIN "public"."payment_methods" "pm" ON (("t"."payment_method_id" = "pm"."id")))
  WHERE (("t"."deleted_at" IS NULL) AND ("l"."deleted_at" IS NULL));


ALTER TABLE "public"."active_transactions" OWNER TO "postgres";


COMMENT ON VIEW "public"."active_transactions" IS '활성 거래 목록 (결제 수단 정보 포함)';



CREATE TABLE IF NOT EXISTS "public"."budgets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ledger_id" "uuid" NOT NULL,
    "category_id" "uuid" NOT NULL,
    "amount" numeric(15,2) NOT NULL,
    "period" "public"."budget_period" DEFAULT 'monthly'::"public"."budget_period",
    "year" integer NOT NULL,
    "month" integer,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone,
    CONSTRAINT "budgets_amount_check" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "budgets_month_check" CHECK ((("month" >= 1) AND ("month" <= 12))),
    CONSTRAINT "check_monthly_budget" CHECK (((("period" = 'monthly'::"public"."budget_period") AND ("month" IS NOT NULL)) OR (("period" = 'yearly'::"public"."budget_period") AND ("month" IS NULL))))
);


ALTER TABLE "public"."budgets" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."budget_vs_actual" WITH ("security_invoker"='on') AS
 SELECT "b"."id" AS "budget_id",
    "b"."ledger_id",
    "b"."category_id",
    "cd"."name" AS "category_name",
    "cd"."color" AS "category_color",
    "cd"."icon" AS "category_icon",
    "b"."amount" AS "budget_amount",
    "b"."period",
    "b"."year",
    "b"."month",
    COALESCE("t"."actual_amount", (0)::numeric) AS "actual_amount",
    ("b"."amount" - COALESCE("t"."actual_amount", (0)::numeric)) AS "remaining_amount",
        CASE
            WHEN ("b"."amount" > (0)::numeric) THEN ((COALESCE("t"."actual_amount", (0)::numeric) / "b"."amount") * (100)::numeric)
            ELSE (0)::numeric
        END AS "usage_percentage"
   FROM (("public"."budgets" "b"
     JOIN "public"."category_details" "cd" ON (("b"."category_id" = "cd"."id")))
     LEFT JOIN ( SELECT "transactions"."category_id",
            EXTRACT(year FROM "transactions"."transaction_date") AS "year",
            EXTRACT(month FROM "transactions"."transaction_date") AS "month",
            "sum"("transactions"."amount") AS "actual_amount"
           FROM "public"."transactions"
          WHERE (("transactions"."deleted_at" IS NULL) AND ("transactions"."type" = 'expense'::"public"."category_type"))
          GROUP BY "transactions"."category_id", (EXTRACT(year FROM "transactions"."transaction_date")), (EXTRACT(month FROM "transactions"."transaction_date"))) "t" ON ((("b"."category_id" = "t"."category_id") AND (("b"."year")::numeric = "t"."year") AND ((("b"."month")::numeric = "t"."month") OR ("b"."period" = 'yearly'::"public"."budget_period")))))
  WHERE ("b"."deleted_at" IS NULL);


ALTER TABLE "public"."budget_vs_actual" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."deleted_accounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "original_user_id" "uuid" NOT NULL,
    "email_hash" "text" NOT NULL,
    "deleted_at" timestamp with time zone NOT NULL,
    "auth_deleted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."deleted_accounts" OWNER TO "postgres";


COMMENT ON TABLE "public"."deleted_accounts" IS '탈퇴 요청된 계정 추적 (30일 유예 기간)';



COMMENT ON COLUMN "public"."deleted_accounts"."email_hash" IS '재가입 방지를 위한 이메일 해시';



COMMENT ON COLUMN "public"."deleted_accounts"."deleted_at" IS '탈퇴 요청 시점 (soft delete)';



COMMENT ON COLUMN "public"."deleted_accounts"."auth_deleted_at" IS '30일 후 auth.users에서 삭제된 시점';



CREATE TABLE IF NOT EXISTS "public"."deletion_job_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "executed_at" timestamp with time zone DEFAULT "now"(),
    "profiles_processed" integer DEFAULT 0,
    "deleted_auth_count" integer DEFAULT 0,
    "error_count" integer DEFAULT 0,
    "errors" "jsonb",
    "details" "jsonb",
    "created_by" "text" DEFAULT 'github-actions'::"text",
    CONSTRAINT "deletion_job_logs_anonymized_count_check" CHECK (("profiles_processed" >= 0)),
    CONSTRAINT "deletion_job_logs_deleted_auth_count_check" CHECK (("deleted_auth_count" >= 0)),
    CONSTRAINT "deletion_job_logs_error_count_check" CHECK (("error_count" >= 0))
);


ALTER TABLE "public"."deletion_job_logs" OWNER TO "postgres";


COMMENT ON TABLE "public"."deletion_job_logs" IS '계정 삭제 배치 작업 로그';



COMMENT ON COLUMN "public"."deletion_job_logs"."profiles_processed" IS '성공적으로 처리된 프로필 수';



COMMENT ON COLUMN "public"."deletion_job_logs"."deleted_auth_count" IS 'auth.users에서 삭제된 계정 수';



COMMENT ON COLUMN "public"."deletion_job_logs"."error_count" IS '처리 중 발생한 오류 수';



COMMENT ON COLUMN "public"."deletion_job_logs"."errors" IS '발생한 에러들의 상세 정보. [{user_id, error_message}, ...]';



CREATE TABLE IF NOT EXISTS "public"."ledger_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ledger_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "public"."member_role" DEFAULT 'member'::"public"."member_role",
    "joined_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone
);


ALTER TABLE "public"."ledger_members" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."ledger_monthly_summary" WITH ("security_invoker"='on') AS
 SELECT "transactions"."ledger_id",
    EXTRACT(year FROM "transactions"."transaction_date") AS "year",
    EXTRACT(month FROM "transactions"."transaction_date") AS "month",
    "transactions"."type",
    "sum"("transactions"."amount") AS "total_amount",
    "count"(*) AS "transaction_count"
   FROM "public"."transactions"
  WHERE ("transactions"."deleted_at" IS NULL)
  GROUP BY "transactions"."ledger_id", (EXTRACT(year FROM "transactions"."transaction_date")), (EXTRACT(month FROM "transactions"."transaction_date")), "transactions"."type";


ALTER TABLE "public"."ledger_monthly_summary" OWNER TO "postgres";


ALTER TABLE ONLY "public"."budgets"
    ADD CONSTRAINT "budgets_ledger_id_category_id_year_month_key" UNIQUE ("ledger_id", "category_id", "year", "month");



ALTER TABLE ONLY "public"."budgets"
    ADD CONSTRAINT "budgets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."category_templates"
    ADD CONSTRAINT "category_templates_name_type_key" UNIQUE ("name", "type");



ALTER TABLE ONLY "public"."category_templates"
    ADD CONSTRAINT "category_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."deleted_accounts"
    ADD CONSTRAINT "deleted_accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."deletion_job_logs"
    ADD CONSTRAINT "deletion_job_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ledger_members"
    ADD CONSTRAINT "ledger_members_ledger_id_user_id_key" UNIQUE ("ledger_id", "user_id");



ALTER TABLE ONLY "public"."ledger_members"
    ADD CONSTRAINT "ledger_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ledgers"
    ADD CONSTRAINT "ledgers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_methods"
    ADD CONSTRAINT "payment_methods_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "unique_ledger_template" UNIQUE ("ledger_id", "template_id");



ALTER TABLE ONLY "public"."deleted_accounts"
    ADD CONSTRAINT "unique_original_user" UNIQUE ("original_user_id");



CREATE INDEX "idx_budgets_ledger_period" ON "public"."budgets" USING "btree" ("ledger_id", "year", "month") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_categories_ledger_active" ON "public"."categories" USING "btree" ("ledger_id", "is_active") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_categories_ledger_custom" ON "public"."categories" USING "btree" ("ledger_id", "name") WHERE (("deleted_at" IS NULL) AND ("name" IS NOT NULL));



CREATE INDEX "idx_categories_ledger_sort" ON "public"."categories" USING "btree" ("ledger_id", "sort_order", "name") WHERE (("deleted_at" IS NULL) AND ("is_active" = true));



CREATE INDEX "idx_categories_ledger_template" ON "public"."categories" USING "btree" ("ledger_id", "template_id") WHERE (("deleted_at" IS NULL) AND ("is_active" = true));



CREATE INDEX "idx_categories_template_id" ON "public"."categories" USING "btree" ("template_id") WHERE (("deleted_at" IS NULL) AND ("template_id" IS NOT NULL));



CREATE INDEX "idx_category_templates_name" ON "public"."category_templates" USING "btree" ("name");



CREATE INDEX "idx_category_templates_type_sort" ON "public"."category_templates" USING "btree" ("type", "sort_order");



CREATE INDEX "idx_deleted_accounts_email_hash" ON "public"."deleted_accounts" USING "btree" ("email_hash");



CREATE INDEX "idx_deletion_job_logs_executed" ON "public"."deletion_job_logs" USING "btree" ("executed_at" DESC);



CREATE INDEX "idx_ledger_members_ledger" ON "public"."ledger_members" USING "btree" ("ledger_id") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_ledger_members_user" ON "public"."ledger_members" USING "btree" ("user_id") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_ledgers_created_by" ON "public"."ledgers" USING "btree" ("created_by") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_payment_methods_ledger" ON "public"."payment_methods" USING "btree" ("ledger_id") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_transactions_ledger_category" ON "public"."transactions" USING "btree" ("ledger_id", "category_id") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_transactions_ledger_date" ON "public"."transactions" USING "btree" ("ledger_id", "transaction_date" DESC) WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_transactions_ledger_type" ON "public"."transactions" USING "btree" ("ledger_id", "type") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_transactions_payment_method" ON "public"."transactions" USING "btree" ("payment_method_id") WHERE ("deleted_at" IS NULL);



CREATE UNIQUE INDEX "unique_active_ledger_custom_name" ON "public"."categories" USING "btree" ("ledger_id", "name", "type") WHERE ("deleted_at" IS NULL);



COMMENT ON INDEX "public"."unique_active_ledger_custom_name" IS '활성 카테고리(삭제되지 않은)에 대해서만 이름 중복을 방지합니다. 삭제된 카테고리 이름은 재사용 가능합니다.';



CREATE UNIQUE INDEX "unique_active_payment_method_name" ON "public"."payment_methods" USING "btree" ("ledger_id", "owner_id", "name") WHERE ("deleted_at" IS NULL);



CREATE UNIQUE INDEX "unique_active_shared_payment_method_name" ON "public"."payment_methods" USING "btree" ("ledger_id", "name") WHERE (("deleted_at" IS NULL) AND ("owner_id" IS NULL));



CREATE OR REPLACE TRIGGER "check_transaction_category_type_trigger" BEFORE INSERT OR UPDATE ON "public"."transactions" FOR EACH ROW EXECUTE FUNCTION "public"."check_transaction_category_type"();



CREATE OR REPLACE TRIGGER "check_transaction_payment_method_match" BEFORE INSERT OR UPDATE ON "public"."transactions" FOR EACH ROW EXECUTE FUNCTION "public"."check_payment_method_ledger_match"();



CREATE OR REPLACE TRIGGER "prevent_category_ledger_change" BEFORE UPDATE ON "public"."categories" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_ledger_id_change"();



CREATE OR REPLACE TRIGGER "prevent_payment_method_ledger_change" BEFORE UPDATE ON "public"."payment_methods" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_ledger_id_change"();



ALTER TABLE ONLY "public"."budgets"
    ADD CONSTRAINT "budgets_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."budgets"
    ADD CONSTRAINT "budgets_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."budgets"
    ADD CONSTRAINT "budgets_ledger_id_fkey" FOREIGN KEY ("ledger_id") REFERENCES "public"."ledgers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_ledger_id_fkey" FOREIGN KEY ("ledger_id") REFERENCES "public"."ledgers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."category_templates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ledger_members"
    ADD CONSTRAINT "ledger_members_ledger_id_fkey" FOREIGN KEY ("ledger_id") REFERENCES "public"."ledgers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ledger_members"
    ADD CONSTRAINT "ledger_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ledgers"
    ADD CONSTRAINT "ledgers_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payment_methods"
    ADD CONSTRAINT "payment_methods_ledger_id_fkey" FOREIGN KEY ("ledger_id") REFERENCES "public"."ledgers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payment_methods"
    ADD CONSTRAINT "payment_methods_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_ledger_id_fkey" FOREIGN KEY ("ledger_id") REFERENCES "public"."ledgers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_paid_by_fkey" FOREIGN KEY ("paid_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_payment_method_id_fkey" FOREIGN KEY ("payment_method_id") REFERENCES "public"."payment_methods"("id") ON DELETE SET NULL;



ALTER TABLE "public"."budgets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "budgets_policy" ON "public"."budgets" USING ((("deleted_at" IS NULL) AND ("ledger_id" IN ( SELECT "ledger_members"."ledger_id"
   FROM "public"."ledger_members"
  WHERE (("ledger_members"."user_id" = "auth"."uid"()) AND ("ledger_members"."deleted_at" IS NULL))))));



ALTER TABLE "public"."categories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "categories_delete_policy" ON "public"."categories" FOR DELETE USING (("ledger_id" IN ( SELECT "ledger_members"."ledger_id"
   FROM "public"."ledger_members"
  WHERE (("ledger_members"."user_id" = "auth"."uid"()) AND ("ledger_members"."role" = 'owner'::"public"."member_role") AND ("ledger_members"."deleted_at" IS NULL)))));



CREATE POLICY "categories_insert_policy" ON "public"."categories" FOR INSERT WITH CHECK (("ledger_id" IN ( SELECT "ledger_members"."ledger_id"
   FROM "public"."ledger_members"
  WHERE (("ledger_members"."user_id" = "auth"."uid"()) AND ("ledger_members"."role" = ANY (ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role", 'member'::"public"."member_role"])) AND ("ledger_members"."deleted_at" IS NULL)))));



CREATE POLICY "categories_select_policy" ON "public"."categories" FOR SELECT USING ((("deleted_at" IS NULL) AND ("ledger_id" IN ( SELECT "ledger_members"."ledger_id"
   FROM "public"."ledger_members"
  WHERE (("ledger_members"."user_id" = "auth"."uid"()) AND ("ledger_members"."deleted_at" IS NULL))))));



CREATE POLICY "categories_update_policy" ON "public"."categories" FOR UPDATE USING (("ledger_id" IN ( SELECT "ledger_members"."ledger_id"
   FROM "public"."ledger_members"
  WHERE (("ledger_members"."user_id" = "auth"."uid"()) AND ("ledger_members"."role" = ANY (ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role", 'member'::"public"."member_role"])) AND ("ledger_members"."deleted_at" IS NULL))))) WITH CHECK (("ledger_id" IN ( SELECT "ledger_members"."ledger_id"
   FROM "public"."ledger_members"
  WHERE (("ledger_members"."user_id" = "auth"."uid"()) AND ("ledger_members"."role" = ANY (ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role", 'member'::"public"."member_role"])) AND ("ledger_members"."deleted_at" IS NULL)))));



ALTER TABLE "public"."category_templates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "category_templates_modify_policy" ON "public"."category_templates" USING (((("auth"."jwt"() ->> 'role'::"text") = 'admin'::"text") OR (("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text")));



CREATE POLICY "category_templates_select_policy" ON "public"."category_templates" FOR SELECT USING (true);



ALTER TABLE "public"."deleted_accounts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "deleted_accounts_service_only" ON "public"."deleted_accounts" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



ALTER TABLE "public"."deletion_job_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "deletion_job_logs_insert" ON "public"."deletion_job_logs" FOR INSERT WITH CHECK ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "deletion_job_logs_select" ON "public"."deletion_job_logs" FOR SELECT USING (true);



ALTER TABLE "public"."ledger_members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ledger_members_delete_policy" ON "public"."ledger_members" FOR DELETE USING ((("user_id" = "auth"."uid"()) OR ("ledger_id" IN ( SELECT "ledgers"."id"
   FROM "public"."ledgers"
  WHERE (("ledgers"."created_by" = "auth"."uid"()) AND ("ledgers"."deleted_at" IS NULL))))));



CREATE POLICY "ledger_members_insert_policy" ON "public"."ledger_members" FOR INSERT WITH CHECK (("ledger_id" IN ( SELECT "ledgers"."id"
   FROM "public"."ledgers"
  WHERE (("ledgers"."created_by" = "auth"."uid"()) AND ("ledgers"."deleted_at" IS NULL)))));



CREATE POLICY "ledger_members_select_policy" ON "public"."ledger_members" FOR SELECT USING (("deleted_at" IS NULL));



CREATE POLICY "ledger_members_update_policy" ON "public"."ledger_members" FOR UPDATE USING ((("deleted_at" IS NULL) AND ("ledger_id" IN ( SELECT "ledgers"."id"
   FROM "public"."ledgers"
  WHERE (("ledgers"."created_by" = "auth"."uid"()) AND ("ledgers"."deleted_at" IS NULL))))));



ALTER TABLE "public"."ledgers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ledgers_delete_policy" ON "public"."ledgers" FOR DELETE USING (("created_by" = "auth"."uid"()));



CREATE POLICY "ledgers_insert_policy" ON "public"."ledgers" FOR INSERT WITH CHECK (("created_by" = "auth"."uid"()));



CREATE POLICY "ledgers_select_policy" ON "public"."ledgers" FOR SELECT USING ((("deleted_at" IS NULL) AND (("created_by" = "auth"."uid"()) OR ("id" IN ( SELECT "ledger_members"."ledger_id"
   FROM "public"."ledger_members"
  WHERE (("ledger_members"."user_id" = "auth"."uid"()) AND ("ledger_members"."deleted_at" IS NULL)))))));



CREATE POLICY "ledgers_update_policy" ON "public"."ledgers" FOR UPDATE USING ((("deleted_at" IS NULL) AND (("created_by" = "auth"."uid"()) OR ("id" IN ( SELECT "ledger_members"."ledger_id"
   FROM "public"."ledger_members"
  WHERE (("ledger_members"."user_id" = "auth"."uid"()) AND ("ledger_members"."role" = ANY (ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role"])) AND ("ledger_members"."deleted_at" IS NULL)))))));



ALTER TABLE "public"."payment_methods" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "payment_methods_insert_policy" ON "public"."payment_methods" FOR INSERT WITH CHECK (("ledger_id" IN ( SELECT "ledger_members"."ledger_id"
   FROM "public"."ledger_members"
  WHERE (("ledger_members"."user_id" = "auth"."uid"()) AND ("ledger_members"."role" = ANY (ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role", 'member'::"public"."member_role"])) AND ("ledger_members"."deleted_at" IS NULL)))));



CREATE POLICY "payment_methods_select_policy" ON "public"."payment_methods" FOR SELECT USING (("ledger_id" IN ( SELECT "ledger_members"."ledger_id"
   FROM "public"."ledger_members"
  WHERE (("ledger_members"."user_id" = "auth"."uid"()) AND ("ledger_members"."deleted_at" IS NULL)))));



CREATE POLICY "payment_methods_update_policy" ON "public"."payment_methods" FOR UPDATE USING ((("deleted_at" IS NULL) AND ("ledger_id" IN ( SELECT "ledger_members"."ledger_id"
   FROM "public"."ledger_members"
  WHERE (("ledger_members"."user_id" = "auth"."uid"()) AND ("ledger_members"."role" = ANY (ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role", 'member'::"public"."member_role"])) AND ("ledger_members"."deleted_at" IS NULL)))))) WITH CHECK ((("deleted_at" IS NULL) AND ("ledger_id" IN ( SELECT "ledger_members"."ledger_id"
   FROM "public"."ledger_members"
  WHERE (("ledger_members"."user_id" = "auth"."uid"()) AND ("ledger_members"."role" = ANY (ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role", 'member'::"public"."member_role"])) AND ("ledger_members"."deleted_at" IS NULL))))));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_ledger_members_select" ON "public"."profiles" FOR SELECT USING ((("deleted_at" IS NULL) AND (("auth"."uid"() = "id") OR (EXISTS ( SELECT 1
   FROM ("public"."ledger_members" "lm1"
     JOIN "public"."ledger_members" "lm2" ON (("lm1"."ledger_id" = "lm2"."ledger_id")))
  WHERE (("lm1"."user_id" = "auth"."uid"()) AND ("lm2"."user_id" = "profiles"."id") AND ("lm1"."deleted_at" IS NULL) AND ("lm2"."deleted_at" IS NULL)))))));



CREATE POLICY "profiles_own_all" ON "public"."profiles" USING ((("auth"."uid"() = "id") AND ("deleted_at" IS NULL))) WITH CHECK (("auth"."uid"() = "id"));



ALTER TABLE "public"."transactions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "transactions_policy" ON "public"."transactions" USING ((("deleted_at" IS NULL) AND ("ledger_id" IN ( SELECT "ledger_members"."ledger_id"
   FROM "public"."ledger_members"
  WHERE (("ledger_members"."user_id" = "auth"."uid"()) AND ("ledger_members"."deleted_at" IS NULL))))));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";





GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

















































































































































































GRANT ALL ON FUNCTION "public"."activate_default_categories"("target_ledger_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."activate_default_categories"("target_ledger_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."activate_default_categories"("target_ledger_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."add_custom_category"("target_ledger_id" "uuid", "category_name" "text", "category_type" "public"."category_type", "category_color" "text", "category_icon" "text", "category_sort_order" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."add_custom_category"("target_ledger_id" "uuid", "category_name" "text", "category_type" "public"."category_type", "category_color" "text", "category_icon" "text", "category_sort_order" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_custom_category"("target_ledger_id" "uuid", "category_name" "text", "category_type" "public"."category_type", "category_color" "text", "category_icon" "text", "category_sort_order" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."check_payment_method_ledger_match"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_payment_method_ledger_match"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_payment_method_ledger_match"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_transaction_category_type"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_transaction_category_type"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_transaction_category_type"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_old_deleted_data"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_old_deleted_data"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_old_deleted_data"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_user_profile"("p_user_id" "uuid", "p_email" "text", "p_full_name" "text", "p_avatar_url" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_user_profile"("p_user_id" "uuid", "p_email" "text", "p_full_name" "text", "p_avatar_url" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_user_profile"("p_user_id" "uuid", "p_email" "text", "p_full_name" "text", "p_avatar_url" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."force_clean_user"("target_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."force_clean_user"("target_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."force_clean_user"("target_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."force_clean_user"("target_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_ledger_monthly_stats"("target_ledger_id" "uuid", "target_year" integer, "target_month" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_ledger_monthly_stats"("target_ledger_id" "uuid", "target_year" integer, "target_month" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_ledger_monthly_stats"("target_ledger_id" "uuid", "target_year" integer, "target_month" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_ledgers"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_ledgers"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_ledgers"() TO "service_role";



GRANT ALL ON FUNCTION "public"."initialize_category_templates"() TO "anon";
GRANT ALL ON FUNCTION "public"."initialize_category_templates"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."initialize_category_templates"() TO "service_role";



GRANT ALL ON FUNCTION "public"."invite_member_to_ledger"("target_ledger_id" "uuid", "target_user_email" "text", "member_role" "public"."member_role") TO "anon";
GRANT ALL ON FUNCTION "public"."invite_member_to_ledger"("target_ledger_id" "uuid", "target_user_email" "text", "member_role" "public"."member_role") TO "authenticated";
GRANT ALL ON FUNCTION "public"."invite_member_to_ledger"("target_ledger_id" "uuid", "target_user_email" "text", "member_role" "public"."member_role") TO "service_role";



GRANT ALL ON FUNCTION "public"."prevent_ledger_id_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_ledger_id_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_ledger_id_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."process_account_deletions"() TO "anon";
GRANT ALL ON FUNCTION "public"."process_account_deletions"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_account_deletions"() TO "service_role";



GRANT ALL ON FUNCTION "public"."process_account_deletions_clean"() TO "anon";
GRANT ALL ON FUNCTION "public"."process_account_deletions_clean"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_account_deletions_clean"() TO "service_role";



GRANT ALL ON FUNCTION "public"."restore_deleted_account"("target_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."restore_deleted_account"("target_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."restore_deleted_account"("target_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_budget"("target_ledger_id" "uuid", "target_category_id" "uuid", "budget_amount" numeric, "budget_year" integer, "budget_month" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."set_budget"("target_ledger_id" "uuid", "target_category_id" "uuid", "budget_amount" numeric, "budget_year" integer, "budget_month" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_budget"("target_ledger_id" "uuid", "target_category_id" "uuid", "budget_amount" numeric, "budget_year" integer, "budget_month" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."setup_new_user"("user_uuid" "uuid", "user_email" "text", "user_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."setup_new_user"("user_uuid" "uuid", "user_email" "text", "user_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."setup_new_user"("user_uuid" "uuid", "user_email" "text", "user_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."soft_delete_category"("category_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."soft_delete_category"("category_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."soft_delete_category"("category_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."soft_delete_ledger"("ledger_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."soft_delete_ledger"("ledger_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."soft_delete_ledger"("ledger_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."soft_delete_payment_method"("target_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."soft_delete_payment_method"("target_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."soft_delete_profile"() TO "anon";
GRANT ALL ON FUNCTION "public"."soft_delete_profile"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."soft_delete_profile"() TO "service_role";



GRANT ALL ON FUNCTION "public"."soft_delete_transaction"("transaction_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."soft_delete_transaction"("transaction_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."soft_delete_transaction"("transaction_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."transfer_ledger_ownership"("p_ledger_id" "uuid", "p_new_owner_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."transfer_ledger_ownership"("p_ledger_id" "uuid", "p_new_owner_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."transfer_ledger_ownership"("p_ledger_id" "uuid", "p_new_owner_id" "uuid") TO "service_role";


















GRANT ALL ON TABLE "public"."categories" TO "anon";
GRANT ALL ON TABLE "public"."categories" TO "authenticated";
GRANT ALL ON TABLE "public"."categories" TO "service_role";



GRANT ALL ON TABLE "public"."category_templates" TO "anon";
GRANT ALL ON TABLE "public"."category_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."category_templates" TO "service_role";



GRANT ALL ON TABLE "public"."category_details" TO "anon";
GRANT ALL ON TABLE "public"."category_details" TO "authenticated";
GRANT ALL ON TABLE "public"."category_details" TO "service_role";



GRANT ALL ON TABLE "public"."ledgers" TO "anon";
GRANT ALL ON TABLE "public"."ledgers" TO "authenticated";
GRANT ALL ON TABLE "public"."ledgers" TO "service_role";



GRANT ALL ON TABLE "public"."payment_methods" TO "anon";
GRANT ALL ON TABLE "public"."payment_methods" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_methods" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."transactions" TO "anon";
GRANT ALL ON TABLE "public"."transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."transactions" TO "service_role";



GRANT ALL ON TABLE "public"."active_transactions" TO "anon";
GRANT ALL ON TABLE "public"."active_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."active_transactions" TO "service_role";



GRANT ALL ON TABLE "public"."budgets" TO "anon";
GRANT ALL ON TABLE "public"."budgets" TO "authenticated";
GRANT ALL ON TABLE "public"."budgets" TO "service_role";



GRANT ALL ON TABLE "public"."budget_vs_actual" TO "anon";
GRANT ALL ON TABLE "public"."budget_vs_actual" TO "authenticated";
GRANT ALL ON TABLE "public"."budget_vs_actual" TO "service_role";



GRANT ALL ON TABLE "public"."deleted_accounts" TO "anon";
GRANT ALL ON TABLE "public"."deleted_accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."deleted_accounts" TO "service_role";



GRANT ALL ON TABLE "public"."deletion_job_logs" TO "anon";
GRANT ALL ON TABLE "public"."deletion_job_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."deletion_job_logs" TO "service_role";



GRANT ALL ON TABLE "public"."ledger_members" TO "anon";
GRANT ALL ON TABLE "public"."ledger_members" TO "authenticated";
GRANT ALL ON TABLE "public"."ledger_members" TO "service_role";



GRANT ALL ON TABLE "public"."ledger_monthly_summary" TO "anon";
GRANT ALL ON TABLE "public"."ledger_monthly_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."ledger_monthly_summary" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";






























