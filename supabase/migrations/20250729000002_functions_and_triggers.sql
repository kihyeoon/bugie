-- Functions and Triggers for Bugie Database
-- Generated: 2025-07-29

-- 1. Handle new user function
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Error handling to ensure user creation doesn't fail
  BEGIN
    -- Create profile directly (supports various OAuth providers)
    INSERT INTO public.profiles (id, email, full_name, avatar_url)
    VALUES (
      new.id,
      new.email,
      COALESCE(
        new.raw_user_meta_data->>'full_name',  -- Google, Kakao
        new.raw_user_meta_data->>'name',       -- Apple, GitHub
        split_part(new.email, '@', 1)          -- Extract from email
      ),
      new.raw_user_meta_data->>'avatar_url'
    );
    
    -- Execute setup_new_user if it exists
    IF EXISTS (
      SELECT 1 FROM pg_proc p 
      JOIN pg_namespace n ON p.pronamespace = n.oid 
      WHERE n.nspname = 'public' AND p.proname = 'setup_new_user'
    ) THEN
      PERFORM setup_new_user(
        new.id,
        new.email,
        COALESCE(
          new.raw_user_meta_data->>'full_name',
          new.raw_user_meta_data->>'name',
          split_part(new.email, '@', 1)
        )
      );
    END IF;
  EXCEPTION
    WHEN others THEN
      -- Log error but don't fail user creation
      RAISE WARNING 'Error in handle_new_user for user %: %', new.id, sqlerrm;
  END;
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user handling
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 2. Setup new user function
CREATE OR REPLACE FUNCTION setup_new_user(user_uuid uuid, user_email text, user_name text)
RETURNS uuid AS $$
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
$$ LANGUAGE plpgsql;

-- 3. Initialize category templates function
CREATE OR REPLACE FUNCTION initialize_category_templates()
RETURNS void AS $$
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
$$ LANGUAGE plpgsql;

-- 4. Activate default categories for a ledger
CREATE OR REPLACE FUNCTION activate_default_categories(target_ledger_id uuid)
RETURNS void AS $$
BEGIN
  INSERT INTO categories (ledger_id, template_id, type)
  SELECT target_ledger_id, ct.id, ct.type
  FROM category_templates ct
  ON CONFLICT (ledger_id, template_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- 5. Check transaction category type match
CREATE OR REPLACE FUNCTION check_transaction_category_type()
RETURNS trigger AS $$
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
$$ LANGUAGE plpgsql;

-- Create trigger for transaction category type validation
CREATE TRIGGER check_transaction_category_type_trigger
  BEFORE INSERT OR UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION check_transaction_category_type();

-- 6. Invite member to ledger function
CREATE OR REPLACE FUNCTION invite_member_to_ledger(
  target_ledger_id uuid,
  target_user_email text,
  member_role member_role DEFAULT 'member'
)
RETURNS boolean AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Set budget function
CREATE OR REPLACE FUNCTION set_budget(
  target_ledger_id uuid,
  target_category_id uuid,
  budget_amount decimal,
  budget_year integer,
  budget_month integer DEFAULT NULL
)
RETURNS uuid AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Add custom category function
CREATE OR REPLACE FUNCTION add_custom_category(
  target_ledger_id uuid,
  category_name text,
  category_type category_type,
  category_color text DEFAULT '#6B7280',
  category_icon text DEFAULT 'tag',
  category_sort_order integer DEFAULT 999
)
RETURNS uuid AS $$
DECLARE
  category_id uuid;
BEGIN
  INSERT INTO categories (ledger_id, name, type, color, icon, sort_order)
  VALUES (target_ledger_id, category_name, category_type, category_color, category_icon, category_sort_order)
  RETURNING id INTO category_id;

  RETURN category_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Get ledger monthly stats function
CREATE OR REPLACE FUNCTION get_ledger_monthly_stats(
  target_ledger_id uuid,
  target_year integer,
  target_month integer
)
RETURNS TABLE(
  total_income decimal,
  total_expense decimal,
  net_amount decimal,
  transaction_count bigint,
  budget_total decimal,
  budget_remaining decimal
) AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Cleanup old deleted data function
CREATE OR REPLACE FUNCTION cleanup_old_deleted_data()
RETURNS void AS $$
BEGIN
  -- Delete data that has been soft deleted for more than 30 days
  DELETE FROM transactions
  WHERE deleted_at IS NOT NULL
    AND deleted_at < now() - INTERVAL '30 days';

  DELETE FROM budgets
  WHERE deleted_at IS NOT NULL
    AND deleted_at < now() - INTERVAL '30 days';

  DELETE FROM categories
  WHERE deleted_at IS NOT NULL
    AND deleted_at < now() - INTERVAL '30 days';

  DELETE FROM ledger_members
  WHERE deleted_at IS NOT NULL
    AND deleted_at < now() - INTERVAL '30 days';

  DELETE FROM ledgers
  WHERE deleted_at IS NOT NULL
    AND deleted_at < now() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;