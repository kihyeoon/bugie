-- Bugie Database Schema
-- Generated: 2025-07-29
-- Description: Initial database schema for Bugie shared ledger application

-- 1. Create ENUM types
CREATE TYPE member_role AS ENUM ('owner', 'admin', 'member', 'viewer');
CREATE TYPE category_type AS ENUM ('income', 'expense');
CREATE TYPE budget_period AS ENUM ('monthly', 'yearly');

-- 2. Create profiles table
CREATE TABLE profiles (
  id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email text,
  full_name text,
  avatar_url text,
  currency text DEFAULT 'KRW',
  timezone text DEFAULT 'Asia/Seoul',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz -- Soft Delete
);

-- Enable RLS for profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policy for profiles
CREATE POLICY "profiles_policy" ON profiles
FOR ALL USING (auth.uid() = id AND deleted_at IS NULL);

-- 3. Create ledgers table
CREATE TABLE ledgers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  currency text DEFAULT 'KRW',
  created_by uuid REFERENCES profiles(id) NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz -- Soft Delete
);

-- Create index for ledgers
CREATE INDEX idx_ledgers_created_by ON ledgers(created_by) WHERE deleted_at IS NULL;

-- Enable RLS for ledgers
ALTER TABLE ledgers ENABLE ROW LEVEL SECURITY;

-- RLS Policy for ledgers
CREATE POLICY "ledgers_policy" ON ledgers FOR ALL USING (
  deleted_at IS NULL AND
  id IN (
    SELECT ledger_id FROM ledger_members
    WHERE user_id = auth.uid() AND deleted_at IS NULL
  )
);

-- 4. Create ledger_members table
CREATE TABLE ledger_members (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ledger_id uuid REFERENCES ledgers(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  role member_role DEFAULT 'member',
  joined_at timestamptz DEFAULT now(),
  deleted_at timestamptz, -- Soft Delete
  
  UNIQUE(ledger_id, user_id)
);

-- Create indexes for ledger_members
CREATE INDEX idx_ledger_members_user ON ledger_members(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_ledger_members_ledger ON ledger_members(ledger_id) WHERE deleted_at IS NULL;

-- Enable RLS for ledger_members
ALTER TABLE ledger_members ENABLE ROW LEVEL SECURITY;

-- RLS Policy for ledger_members
CREATE POLICY "ledger_members_policy" ON ledger_members FOR ALL USING (
  deleted_at IS NULL AND (
    user_id = auth.uid() OR
    ledger_id IN (
      SELECT ledger_id FROM ledger_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND deleted_at IS NULL
    )
  )
);

-- 5. Create category_templates table
CREATE TABLE category_templates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  type category_type NOT NULL,
  color text DEFAULT '#3B82F6',
  icon text DEFAULT 'receipt',
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(name, type)
);

-- Create indexes for category_templates
CREATE INDEX idx_category_templates_type_sort ON category_templates(type, sort_order);
CREATE INDEX idx_category_templates_name ON category_templates(name);

-- Enable RLS for category_templates
ALTER TABLE category_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for category_templates
CREATE POLICY "category_templates_select_policy" ON category_templates
FOR SELECT USING (true);

CREATE POLICY "category_templates_modify_policy" ON category_templates
FOR ALL USING (
  auth.jwt() ->> 'role' = 'admin' OR
  auth.jwt() ->> 'role' = 'service_role'
);

-- 6. Create categories table
CREATE TABLE categories (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ledger_id uuid REFERENCES ledgers(id) ON DELETE CASCADE NOT NULL,
  template_id uuid REFERENCES category_templates(id) ON DELETE CASCADE,
  
  -- Custom category fields
  name text,
  type category_type NOT NULL,
  color text DEFAULT '#6B7280',
  icon text DEFAULT 'tag',
  sort_order integer DEFAULT 0,
  
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz, -- Soft Delete
  
  -- Constraints: template-based OR custom (one or the other)
  CONSTRAINT check_category_source CHECK (
    (template_id IS NOT NULL AND name IS NULL) OR
    (template_id IS NULL AND name IS NOT NULL)
  ),
  
  -- Prevent duplicate templates per ledger
  CONSTRAINT unique_ledger_template UNIQUE(ledger_id, template_id),
  
  -- Prevent duplicate custom names per ledger
  CONSTRAINT unique_ledger_custom_name UNIQUE(ledger_id, name, type)
);

-- Create indexes for categories
CREATE INDEX idx_categories_ledger_template ON categories(ledger_id, template_id)
WHERE deleted_at IS NULL AND is_active = true;

CREATE INDEX idx_categories_ledger_active ON categories(ledger_id, is_active)
WHERE deleted_at IS NULL;

CREATE INDEX idx_categories_template_id ON categories(template_id)
WHERE deleted_at IS NULL AND template_id IS NOT NULL;

CREATE INDEX idx_categories_ledger_custom ON categories(ledger_id, name)
WHERE deleted_at IS NULL AND name IS NOT NULL;

CREATE INDEX idx_categories_ledger_sort ON categories(ledger_id, sort_order, name)
WHERE deleted_at IS NULL AND is_active = true;

-- Enable RLS for categories
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- RLS Policy for categories
CREATE POLICY "categories_policy" ON categories FOR ALL USING (
  deleted_at IS NULL AND
  ledger_id IN (
    SELECT ledger_id FROM ledger_members
    WHERE user_id = auth.uid() AND deleted_at IS NULL
  )
);

-- 7. Create transactions table
CREATE TABLE transactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ledger_id uuid REFERENCES ledgers(id) ON DELETE CASCADE NOT NULL,
  category_id uuid REFERENCES categories(id) ON DELETE RESTRICT NOT NULL,
  created_by uuid REFERENCES profiles(id) NOT NULL,
  amount decimal(15,2) NOT NULL CHECK (amount > 0),
  type category_type NOT NULL,
  title text NOT NULL,
  description text,
  transaction_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz -- Soft Delete
);

-- Create indexes for transactions
CREATE INDEX idx_transactions_ledger_date ON transactions(ledger_id, transaction_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_transactions_ledger_category ON transactions(ledger_id, category_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_transactions_ledger_type ON transactions(ledger_id, type) WHERE deleted_at IS NULL;

-- Enable RLS for transactions
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policy for transactions
CREATE POLICY "transactions_policy" ON transactions FOR ALL USING (
  deleted_at IS NULL AND
  ledger_id IN (
    SELECT ledger_id FROM ledger_members
    WHERE user_id = auth.uid() AND deleted_at IS NULL
  )
);

-- 8. Create budgets table
CREATE TABLE budgets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ledger_id uuid REFERENCES ledgers(id) ON DELETE CASCADE NOT NULL,
  category_id uuid REFERENCES categories(id) ON DELETE CASCADE NOT NULL,
  amount decimal(15,2) NOT NULL CHECK (amount > 0),
  period budget_period DEFAULT 'monthly',
  year integer NOT NULL,
  month integer CHECK (month BETWEEN 1 AND 12),
  created_by uuid REFERENCES profiles(id) NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz, -- Soft Delete
  
  -- Monthly budgets require month, yearly budgets don't
  CONSTRAINT check_monthly_budget CHECK (
    (period = 'monthly' AND month IS NOT NULL) OR
    (period = 'yearly' AND month IS NULL)
  ),
  
  UNIQUE(ledger_id, category_id, year, month)
);

-- Create index for budgets
CREATE INDEX idx_budgets_ledger_period ON budgets(ledger_id, year, month) WHERE deleted_at IS NULL;

-- Enable RLS for budgets
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;

-- RLS Policy for budgets
CREATE POLICY "budgets_policy" ON budgets FOR ALL USING (
  deleted_at IS NULL AND
  ledger_id IN (
    SELECT ledger_id FROM ledger_members
    WHERE user_id = auth.uid() AND deleted_at IS NULL
  )
);