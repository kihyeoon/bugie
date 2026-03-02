-- Seed data for category templates
-- Generated: 2025-07-29
-- Note: This migration is idempotent - can be run multiple times safely

-- Initialize category templates if not already done
SELECT initialize_category_templates();

-- Alternatively, you can use direct INSERT statements:
-- This approach gives more control and visibility

/*
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
*/