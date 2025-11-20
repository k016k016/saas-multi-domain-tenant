-- ============================================================
-- Fix RLS Infinite Recursion on profiles table
-- ============================================================
--
-- :
-- profiles  RLS 
--
-- :
-- 1. auth.jwt() (role, org_id)
-- 2. 
--
-- 2:
-- - profile
-- - profile
-- - profile
-- ============================================================

-- 
DROP POLICY IF EXISTS "profiles_select_policy" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_policy" ON profiles;
DROP POLICY IF EXISTS "profiles_update_policy" ON profiles;
DROP POLICY IF EXISTS "profiles_delete_policy" ON profiles;

-- ------------------------------------------------------------
--  profiles  RLS 
-- ------------------------------------------------------------

-- SELECT: profile
-- Cookieprofile
CREATE POLICY "profiles_select_own"
ON profiles
FOR SELECT
USING (
  -- profile
  user_id = auth.uid()
);

-- SELECT: ops roleprofile
-- 
CREATE POLICY "profiles_select_ops"
ON profiles
FOR SELECT
USING (
  -- 
  EXISTS (
    SELECT 1 FROM profiles AS p
    WHERE p.user_id = auth.uid()
    AND p.role = 'ops'
  )
);

-- INSERT: ops roleadmin/ownerprofile
CREATE POLICY "profiles_insert_admin"
ON profiles
FOR INSERT
WITH CHECK (
  -- ops roleprofile
  EXISTS (
    SELECT 1 FROM profiles AS p
    WHERE p.user_id = auth.uid()
    AND p.role = 'ops'
  )
  OR
  -- admin/ownerprofile
  EXISTS (
    SELECT 1 FROM profiles AS p
    WHERE p.user_id = auth.uid()
    AND p.org_id = profiles.org_id
    AND p.role IN ('admin', 'owner')
  )
);

-- UPDATE: profile(roleorg_id)
CREATE POLICY "profiles_update_own"
ON profiles
FOR UPDATE
USING (
  user_id = auth.uid()
)
WITH CHECK (
  user_id = auth.uid()
  -- : role  org_id 
);

-- UPDATE: admin/owner/opsprofile
CREATE POLICY "profiles_update_admin"
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

-- DELETE: admin/owner/opsprofile
-- owner
CREATE POLICY "profiles_delete_admin"
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
-- organizations  RLS 
-- ------------------------------------------------------------
-- SELECT 

DROP POLICY IF EXISTS "organizations_select_policy" ON organizations;

-- SELECT: 
CREATE POLICY "organizations_select_member"
ON organizations
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.org_id = organizations.id
  )
);

-- SELECT: ops role
CREATE POLICY "organizations_select_ops"
ON organizations
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role = 'ops'
  )
);

-- ------------------------------------------------------------
-- activity_logs  RLS 
-- (profiles profiles )
-- ------------------------------------------------------------

COMMENT ON POLICY "profiles_select_own" ON profiles IS 'profile';
COMMENT ON POLICY "profiles_select_ops" ON profiles IS 'ops roleprofile';
COMMENT ON POLICY "profiles_insert_admin" ON profiles IS 'ops/admin/ownerprofile';
COMMENT ON POLICY "profiles_update_own" ON profiles IS 'profile';
COMMENT ON POLICY "profiles_update_admin" ON profiles IS 'admin/owner/opsprofile';
COMMENT ON POLICY "profiles_delete_admin" ON profiles IS 'admin/owner/opsprofile';
COMMENT ON POLICY "organizations_select_member" ON organizations IS '';
COMMENT ON POLICY "organizations_select_ops" ON organizations IS 'ops role';
