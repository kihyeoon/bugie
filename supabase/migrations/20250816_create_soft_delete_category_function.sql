-- Create RPC function for soft deleting categories
-- Generated: 2025-08-16
-- Description: Bypasses the RETURNING issue with RLS policies when soft deleting

CREATE OR REPLACE FUNCTION soft_delete_category(category_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION soft_delete_category(uuid) TO authenticated;

-- Add comment
COMMENT ON FUNCTION soft_delete_category(uuid) IS 'Soft delete a category with proper permission checks';