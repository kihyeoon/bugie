-- Fix RLS infinite recursion issue for ledger_members table
-- Generated: 2025-08-03
-- Description: Resolves infinite recursion in ledger_members RLS policy by splitting policies and avoiding self-reference

-- 1. Drop existing problematic policies
DROP POLICY IF EXISTS "ledger_members_policy" ON ledger_members;
DROP POLICY IF EXISTS "ledgers_policy" ON ledgers;

-- 2. Create new policies for ledger_members table

-- 2.1 SELECT policy: View member information (EXISTS를 사용하여 자기 참조 방지)
CREATE POLICY "ledger_members_select_policy" ON ledger_members
FOR SELECT USING (
  deleted_at IS NULL AND (
    -- Users can always see their own membership
    user_id = auth.uid() 
    OR
    -- Users can see other members in ledgers they belong to (자기 참조 없이)
    EXISTS (
      SELECT 1 
      FROM ledger_members lm1
      WHERE lm1.user_id = auth.uid() 
      AND lm1.ledger_id = ledger_members.ledger_id
      AND lm1.deleted_at IS NULL
    )
  )
);

-- 2.2 INSERT policy: Add new members (owner/admin only)
CREATE POLICY "ledger_members_insert_policy" ON ledger_members
FOR INSERT WITH CHECK (
  deleted_at IS NULL AND (
    -- Ledger creator can add members
    ledger_id IN (
      SELECT id FROM ledgers 
      WHERE created_by = auth.uid() 
      AND deleted_at IS NULL
    )
    OR
    -- Admins can add members
    EXISTS (
      SELECT 1 
      FROM ledger_members lm
      WHERE lm.ledger_id = ledger_members.ledger_id
      AND lm.user_id = auth.uid()
      AND lm.role IN ('owner', 'admin')
      AND lm.deleted_at IS NULL
    )
  )
);

-- 2.3 UPDATE policy: Modify member information (owner/admin only)
CREATE POLICY "ledger_members_update_policy" ON ledger_members
FOR UPDATE USING (
  deleted_at IS NULL AND (
    -- Ledger creator can update members
    ledger_id IN (
      SELECT id FROM ledgers 
      WHERE created_by = auth.uid() 
      AND deleted_at IS NULL
    )
    OR
    -- Admins can update members
    EXISTS (
      SELECT 1 
      FROM ledger_members lm
      WHERE lm.ledger_id = ledger_members.ledger_id
      AND lm.user_id = auth.uid()
      AND lm.role IN ('owner', 'admin')
      AND lm.deleted_at IS NULL
    )
  )
);

-- 2.4 DELETE policy: Remove members
CREATE POLICY "ledger_members_delete_policy" ON ledger_members
FOR DELETE USING (
  deleted_at IS NULL AND (
    -- Users can remove themselves (leave ledger)
    user_id = auth.uid()
    OR
    -- Ledger creator can remove any member
    ledger_id IN (
      SELECT id FROM ledgers 
      WHERE created_by = auth.uid() 
      AND deleted_at IS NULL
    )
  )
);

-- 3. Create new policies for ledgers table

-- 3.1 SELECT policy: View ledgers
CREATE POLICY "ledgers_select_policy" ON ledgers
FOR SELECT USING (
  deleted_at IS NULL AND (
    -- Creator can always see their ledgers
    created_by = auth.uid()
    OR
    -- Members can see ledgers they belong to
    id IN (
      SELECT ledger_id 
      FROM ledger_members 
      WHERE user_id = auth.uid() 
      AND deleted_at IS NULL
    )
  )
);

-- 3.2 INSERT policy: Create new ledgers
CREATE POLICY "ledgers_insert_policy" ON ledgers
FOR INSERT WITH CHECK (
  -- Anyone can create a ledger (they become the owner)
  created_by = auth.uid()
);

-- 3.3 UPDATE policy: Modify ledger information
CREATE POLICY "ledgers_update_policy" ON ledgers
FOR UPDATE USING (
  deleted_at IS NULL AND (
    -- Creator can update their ledgers
    created_by = auth.uid()
    OR
    -- Admins can update ledgers
    id IN (
      SELECT ledger_id 
      FROM ledger_members 
      WHERE user_id = auth.uid() 
      AND role IN ('owner', 'admin')
      AND deleted_at IS NULL
    )
  )
);

-- 3.4 DELETE policy: Remove ledgers (soft delete)
CREATE POLICY "ledgers_delete_policy" ON ledgers
FOR DELETE USING (
  -- Only creator can delete ledgers
  created_by = auth.uid()
);