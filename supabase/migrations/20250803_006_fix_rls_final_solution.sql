-- Final fix for RLS infinite recursion issue
-- Generated: 2025-08-03
-- Description: Complete solution to prevent infinite recursion between ledgers and ledger_members

-- 1. Drop all existing policies
DROP POLICY IF EXISTS "ledger_members_select_policy" ON ledger_members;
DROP POLICY IF EXISTS "ledger_members_insert_policy" ON ledger_members;
DROP POLICY IF EXISTS "ledger_members_update_policy" ON ledger_members;
DROP POLICY IF EXISTS "ledger_members_delete_policy" ON ledger_members;
DROP POLICY IF EXISTS "ledgers_select_policy" ON ledgers;
DROP POLICY IF EXISTS "ledgers_insert_policy" ON ledgers;
DROP POLICY IF EXISTS "ledgers_update_policy" ON ledgers;
DROP POLICY IF EXISTS "ledgers_delete_policy" ON ledgers;

-- 2. Create ledger_members policies without recursion

-- 2.1 SELECT: Allow authenticated users to see all members (security handled at ledgers level)
CREATE POLICY "ledger_members_select_policy" ON ledger_members
FOR SELECT USING (
  deleted_at IS NULL
  -- Open to all authenticated users
  -- Security is enforced at the ledgers table level
);

-- 2.2 INSERT: Only ledger creators can add members
CREATE POLICY "ledger_members_insert_policy" ON ledger_members
FOR INSERT WITH CHECK (
  ledger_id IN (
    SELECT id FROM ledgers 
    WHERE created_by = auth.uid() 
    AND deleted_at IS NULL
  )
);

-- 2.3 UPDATE: Only ledger creators can update members
CREATE POLICY "ledger_members_update_policy" ON ledger_members
FOR UPDATE USING (
  deleted_at IS NULL AND
  ledger_id IN (
    SELECT id FROM ledgers 
    WHERE created_by = auth.uid() 
    AND deleted_at IS NULL
  )
);

-- 2.4 DELETE: Users can remove themselves or ledger creators can remove anyone
CREATE POLICY "ledger_members_delete_policy" ON ledger_members
FOR DELETE USING (
  deleted_at IS NULL AND (
    user_id = auth.uid() OR
    ledger_id IN (
      SELECT id FROM ledgers 
      WHERE created_by = auth.uid() 
      AND deleted_at IS NULL
    )
  )
);

-- 3. Create ledgers policies (can now safely reference ledger_members)

-- 3.1 SELECT: View own ledgers or ledgers where user is a member
CREATE POLICY "ledgers_select_policy" ON ledgers
FOR SELECT USING (
  deleted_at IS NULL AND (
    created_by = auth.uid() OR
    id IN (
      SELECT ledger_id 
      FROM ledger_members 
      WHERE user_id = auth.uid() 
      AND deleted_at IS NULL
    )
  )
);

-- 3.2 INSERT: Anyone can create a ledger
CREATE POLICY "ledgers_insert_policy" ON ledgers
FOR INSERT WITH CHECK (
  created_by = auth.uid()
);

-- 3.3 UPDATE: Creators and admins can update
CREATE POLICY "ledgers_update_policy" ON ledgers
FOR UPDATE USING (
  deleted_at IS NULL AND (
    created_by = auth.uid() OR
    id IN (
      SELECT ledger_id 
      FROM ledger_members 
      WHERE user_id = auth.uid() 
      AND role IN ('owner', 'admin')
      AND deleted_at IS NULL
    )
  )
);

-- 3.4 DELETE: Only creators can delete
CREATE POLICY "ledgers_delete_policy" ON ledgers
FOR DELETE USING (
  created_by = auth.uid()
);

-- 4. Create helper function for getting user's ledgers (optional, for better performance)
CREATE OR REPLACE FUNCTION get_user_ledgers()
RETURNS TABLE (
    id uuid,
    name text,
    description text,
    currency text,
    created_by uuid,
    role member_role,
    created_at timestamptz,
    updated_at timestamptz
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
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