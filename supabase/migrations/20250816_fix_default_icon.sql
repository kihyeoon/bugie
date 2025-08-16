-- Fix default icon value for categories
-- Generated: 2025-08-16
-- Description: Change default icon from 'tag' to 'pricetag' (Ionicons compatible)

-- Update default value for categories table
ALTER TABLE categories 
ALTER COLUMN icon SET DEFAULT 'pricetag';

-- Update existing 'tag' icons to 'pricetag'
UPDATE categories 
SET icon = 'pricetag' 
WHERE icon = 'tag';

-- Update category_templates if any have 'tag'
UPDATE category_templates 
SET icon = 'pricetag' 
WHERE icon = 'tag';

-- Update the add_custom_category function default parameter
CREATE OR REPLACE FUNCTION add_custom_category(
  target_ledger_id uuid,
  category_name text,
  category_type category_type,
  category_color text DEFAULT '#6B7280',
  category_icon text DEFAULT 'pricetag',  -- Changed from 'tag'
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