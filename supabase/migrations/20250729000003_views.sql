-- Views for Bugie Database
-- Generated: 2025-07-29

-- 1. Category details view (combines template and custom categories)
CREATE VIEW category_details AS
SELECT
  c.id,
  c.ledger_id,
  c.template_id,
  
  -- Use template info for template-based, custom info for custom categories
  COALESCE(ct.name, c.name) AS name,
  COALESCE(ct.color, c.color) AS color,
  COALESCE(ct.icon, c.icon) AS icon,
  COALESCE(c.type, ct.type) AS type,
  
  c.is_active,
  c.created_at,
  c.updated_at,
  
  -- Category source type
  CASE
    WHEN c.template_id IS NOT NULL THEN 'template'
    ELSE 'custom'
  END AS source_type,
  
  -- Sort order: template's sort_order for templates, custom's sort_order for custom
  CASE
    WHEN c.template_id IS NOT NULL THEN ct.sort_order
    ELSE c.sort_order
  END AS sort_order

FROM categories c
LEFT JOIN category_templates ct ON c.template_id = ct.id
WHERE c.deleted_at IS NULL
  AND c.is_active = true;

-- 2. Active transactions view (with joined metadata)
CREATE VIEW active_transactions AS
SELECT
  t.*,
  cd.name AS category_name,
  cd.color AS category_color,
  cd.icon AS category_icon,
  cd.source_type AS category_source,
  l.name AS ledger_name,
  p.full_name AS created_by_name
FROM transactions t
JOIN category_details cd ON t.category_id = cd.id
JOIN ledgers l ON t.ledger_id = l.id
JOIN profiles p ON t.created_by = p.id
WHERE t.deleted_at IS NULL
  AND l.deleted_at IS NULL;

-- 3. Ledger monthly summary view
CREATE VIEW ledger_monthly_summary AS
SELECT
  ledger_id,
  EXTRACT(year FROM transaction_date) AS year,
  EXTRACT(month FROM transaction_date) AS month,
  type,
  SUM(amount) AS total_amount,
  COUNT(*) AS transaction_count
FROM transactions
WHERE deleted_at IS NULL
GROUP BY ledger_id, year, month, type;

-- 4. Budget vs actual view
CREATE VIEW budget_vs_actual AS
SELECT
  b.id AS budget_id,
  b.ledger_id,
  b.category_id,
  cd.name AS category_name,
  cd.color AS category_color,
  cd.icon AS category_icon,
  b.amount AS budget_amount,
  b.period,
  b.year,
  b.month,
  COALESCE(t.actual_amount, 0) AS actual_amount,
  b.amount - COALESCE(t.actual_amount, 0) AS remaining_amount,
  CASE
    WHEN b.amount > 0 THEN (COALESCE(t.actual_amount, 0) / b.amount * 100)
    ELSE 0
  END AS usage_percentage
FROM budgets b
JOIN category_details cd ON b.category_id = cd.id
LEFT JOIN (
  SELECT
    category_id,
    EXTRACT(year FROM transaction_date) AS year,
    EXTRACT(month FROM transaction_date) AS month,
    SUM(amount) AS actual_amount
  FROM transactions
  WHERE deleted_at IS NULL AND type = 'expense'
  GROUP BY category_id, year, month
) t ON b.category_id = t.category_id
  AND b.year = t.year
  AND (b.month = t.month OR b.period = 'yearly')
WHERE b.deleted_at IS NULL;