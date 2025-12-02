-- ============================================================
-- Multi-Tenant SaaS Database Schema
-- ============================================================
--
-- Multi-tenant architecture design principles:
--
-- 1. Tenant Isolation
--    - All tables use org_id for tenant separation
--    - Organizations (org) are the core tenant unit
--    - All operations require org_id verification
--
-- 2. Row Level Security (RLS)
--    - RLS policies enforce tenant isolation
--    - org_id-based access control
--    - User operations limited to their org_id only
--
-- 3. Owner Permissions
--    - Each organization has exactly one owner
--    - Owner has full administrative rights
--    - Owner or admin can transfer ownership
--
-- 4. Role Hierarchy
--    - Roles: member < admin < owner (ops is global)
--    - Strict role-based access control
--
-- 5. Audit Logs (activity_logs)
--    - All important operations logged in activity_logs:
--      - Organization switches
--      - Member CRUD operations
--      - Owner transfers and payment updates
--
-- ============================================================

-- organizations table
-- Organization master table (tenant unit)
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'free', -- 'free' | 'basic' | 'business' | 'enterprise'
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE organizations IS 'Organization master table. Soft-delete with is_active=false';
COMMENT ON COLUMN organizations.id IS 'Organization identifier (UUID)';
COMMENT ON COLUMN organizations.name IS 'Organization display name';
COMMENT ON COLUMN organizations.plan IS 'Subscription plan tier';
COMMENT ON COLUMN organizations.is_active IS 'Active flag. False means suspended/archived';

-- profiles table
-- User-organization membership and role assignment
-- One user can belong to multiple organizations with (user_id, org_id) unique constraint
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL, -- References auth.users.id from Supabase Auth
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('member', 'admin', 'owner', 'ops')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, org_id)
);

COMMENT ON TABLE profiles IS 'User-organization membership. One user can belong to multiple orgs';
COMMENT ON COLUMN profiles.user_id IS 'User ID from Supabase Auth (auth.users.id)';
COMMENT ON COLUMN profiles.org_id IS 'Organization reference';
COMMENT ON COLUMN profiles.role IS 'User role: member | admin | owner | ops (ops is global)';
COMMENT ON COLUMN profiles.metadata IS 'User-specific metadata as JSON';

-- Business rule: Each organization must have exactly one owner
-- Owner cannot be deleted directly
-- Ownership transfer: owner demoted to admin while new owner promoted

-- activity_logs table
-- Audit trail for all important operations
CREATE TABLE IF NOT EXISTS activity_logs (
  id BIGSERIAL PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL, -- User who performed the action
  action TEXT NOT NULL, -- 'org_switch' | 'user_created' | 'user_role_changed' | 'payment_updated' | 'org_suspended' | 'owner_transferred' etc
  payload JSONB DEFAULT '{}', -- Operation details as JSON
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE activity_logs IS 'Audit log for tenant operations (immutable)';
COMMENT ON COLUMN activity_logs.org_id IS 'Organization context for the action';
COMMENT ON COLUMN activity_logs.user_id IS 'User who performed the action';
COMMENT ON COLUMN activity_logs.action IS 'Action type: org_switch, user_created, payment_updated, etc';
COMMENT ON COLUMN activity_logs.payload IS 'Operation details in JSON format';

-- Indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_org_id ON profiles(org_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_org_id ON activity_logs(org_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);

-- ============================================================
-- Row Level Security (RLS) Policies
-- ============================================================
--
-- org_id nY RLS 
-- %DTnoDBghk>K
--
-- jG:
-- - RLS !Yo1WjD
-- - org_id XMn6o
-- - z- RLS  OFF kYShob
-- - ops oyhWfhDTnk
--
-- ============================================================

-- RLS 
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- 1. organizations n RLS 
-- ------------------------------------------------------------

-- SELECTL profiles L1g@^WfD org n
-- ops ohDTk
CREATE POLICY "organizations_select_policy"
ON organizations
FOR SELECT
USING (
  -- ops n4ohDTk
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role = 'ops'
  )
  OR
  -- 8oL@^YDTn
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.org_id = organizations.id
  )
);

-- UPDATE: admin or owner can update organization settings
CREATE POLICY "organizations_update_policy"
ON organizations
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.org_id = organizations.id
    AND profiles.role IN ('admin', 'owner', 'ops')
  )
);

-- INSERTops nDT\
CREATE POLICY "organizations_insert_policy"
ON organizations
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role = 'ops'
  )
);

-- DELETEops nDTJd
CREATE POLICY "organizations_delete_policy"
ON organizations
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role = 'ops'
  )
);

-- ------------------------------------------------------------
-- 2. profiles n RLS 
-- ------------------------------------------------------------

-- SELECTL@^WfD org nn
-- ops ohk
CREATE POLICY "profiles_select_policy"
ON profiles
FOR SELECT
USING (
  -- ops n4ohk
  EXISTS (
    SELECT 1 FROM profiles AS p
    WHERE p.user_id = auth.uid()
    AND p.role = 'ops'
  )
  OR
  -- 8oL@^YDTnn
  EXISTS (
    SELECT 1 FROM profiles AS p
    WHERE p.user_id = auth.uid()
    AND p.org_id = profiles.org_id
  )
);

-- INSERT: admin or owner can add new members
CREATE POLICY "profiles_insert_policy"
ON profiles
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles AS p
    WHERE p.user_id = auth.uid()
    AND p.org_id = profiles.org_id
    AND p.role IN ('admin', 'owner', 'ops')
  )
);

-- UPDATE: admin or owner can update member roles
CREATE POLICY "profiles_update_policy"
ON profiles
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles AS p
    WHERE p.user_id = auth.uid()
    AND p.org_id = profiles.org_id
    AND p.role IN ('admin', 'owner', 'ops')
  )
);

-- DELETE: admin or owner can remove members
-- Note: Owner deletion requires special business logic to prevent orphaned orgs
CREATE POLICY "profiles_delete_policy"
ON profiles
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM profiles AS p
    WHERE p.user_id = auth.uid()
    AND p.org_id = profiles.org_id
    AND p.role IN ('admin', 'owner', 'ops')
  )
);

-- ------------------------------------------------------------
-- 3. activity_logs n RLS 
-- ------------------------------------------------------------

-- SELECTL@^WfD org nn
-- ops ohk
CREATE POLICY "activity_logs_select_policy"
ON activity_logs
FOR SELECT
USING (
  -- ops n4ohk
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role = 'ops'
  )
  OR
  -- 8oL@^YDTnn
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.org_id = activity_logs.org_id
  )
);

-- INSERTYyfn<L?e
-- L@^YDTnn
CREATE POLICY "activity_logs_insert_policy"
ON activity_logs
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.org_id = activity_logs.org_id
  )
);

