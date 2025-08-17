-- Fix categories RLS policy for UPDATE operations
-- Generated: 2025-08-16
-- Description: Split the single FOR ALL policy into separate policies for each operation
-- This fixes the "new row violates row-level security policy" error when updating categories (soft delete)

-- 1. Drop existing policy
DROP POLICY IF EXISTS "categories_policy" ON categories;

-- 2. Create separate policies for each operation

-- 2.1 SELECT: Allow viewing categories for ledgers where user is a member
CREATE POLICY "categories_select_policy" ON categories
FOR SELECT USING (
  deleted_at IS NULL AND
  ledger_id IN (
    SELECT ledger_id FROM ledger_members
    WHERE user_id = auth.uid() AND deleted_at IS NULL
  )
);

-- 2.2 INSERT: Allow members and above to create categories
CREATE POLICY "categories_insert_policy" ON categories
FOR INSERT WITH CHECK (
  ledger_id IN (
    SELECT ledger_id FROM ledger_members
    WHERE user_id = auth.uid() 
    AND role IN ('owner', 'admin', 'member')
    AND deleted_at IS NULL
  )
);

-- 2.3 UPDATE: Allow members and above to update categories (including soft delete)
-- Important: WITH CHECK must be explicit to properly handle soft delete
-- USING: Pre-update access check
-- WITH CHECK: Post-update validation (allows soft delete by not checking deleted_at)
CREATE POLICY "categories_update_policy" ON categories
FOR UPDATE 
USING (
  -- Pre-update: User must have permission to access this row
  ledger_id IN (
    SELECT ledger_id FROM ledger_members
    WHERE user_id = auth.uid() 
    AND role IN ('owner', 'admin', 'member')
    AND deleted_at IS NULL
  )
)
WITH CHECK (
  -- Post-update: Allow soft delete by only checking ledger membership
  -- No deleted_at check here enables soft delete to work
  ledger_id IN (
    SELECT ledger_id FROM ledger_members
    WHERE user_id = auth.uid() 
    AND role IN ('owner', 'admin', 'member')
    AND deleted_at IS NULL
  )
);

-- 2.4 DELETE: Only owners can hard delete (though we use soft delete in practice)
CREATE POLICY "categories_delete_policy" ON categories
FOR DELETE USING (
  ledger_id IN (
    SELECT ledger_id FROM ledger_members
    WHERE user_id = auth.uid() 
    AND role = 'owner'
    AND deleted_at IS NULL
  )
);

-- Note: This approach avoids circular reference issues because:
-- 1. ledger_members has an open SELECT policy (see 20250803_006_fix_rls_final_solution.sql)
-- 2. categories references ledger_members, but not vice versa
-- 3. UPDATE policy uses explicit WITH CHECK to properly handle soft delete
--    USING clause: checks pre-update access rights
--    WITH CHECK clause: validates post-update state (allows deleted_at to be set)