-- ============================================================
-- Fix RLS Infinite Recursion - Final Fix
-- ============================================================
--
-- :
--  profiles_select_ops 
-- profiles 
--
-- :
-- RLS
-- - profile
-- - INSERT/UPDATE/DELETEprofile
-- ============================================================

-- 
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
DROP POLICY IF EXISTS "profiles_select_ops" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_admin" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
DROP POLICY IF EXISTS "profiles_update_admin" ON profiles;
DROP POLICY IF EXISTS "profiles_delete_admin" ON profiles;

DROP POLICY IF EXISTS "organizations_select_member" ON organizations;
DROP POLICY IF EXISTS "organizations_select_ops" ON organizations;

-- ------------------------------------------------------------
--  profiles  RLS  - 
-- ------------------------------------------------------------

-- SELECT: profile
-- Cookieprofile
-- profile
CREATE POLICY "profiles_select_own"
ON profiles
FOR SELECT
USING (
  -- profile
  user_id = auth.uid()
);

-- INSERT: profile
-- ()
CREATE POLICY "profiles_insert_any"
ON profiles
FOR INSERT
WITH CHECK (
  -- profile
  auth.uid() IS NOT NULL
);

-- UPDATE: profile
CREATE POLICY "profiles_update_own"
ON profiles
FOR UPDATE
USING (
  user_id = auth.uid()
)
WITH CHECK (
  user_id = auth.uid()
);

-- DELETE: profile
CREATE POLICY "profiles_delete_own"
ON profiles
FOR DELETE
USING (
  user_id = auth.uid()
);

-- ------------------------------------------------------------
-- organizations  RLS  - 
-- ------------------------------------------------------------

-- SELECT: profilesOK
CREATE POLICY "organizations_select_member"
ON organizations
FOR SELECT
USING (
  -- profilesprofilesorganizationsOK
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.org_id = organizations.id
  )
);

-- INSERT: 
-- (ops role)
CREATE POLICY "organizations_insert_any"
ON organizations
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
);

-- UPDATE: 
-- (role)
CREATE POLICY "organizations_update_member"
ON organizations
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.org_id = organizations.id
  )
);

-- DELETE: 
-- (role)
CREATE POLICY "organizations_delete_member"
ON organizations
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.org_id = organizations.id
  )
);

COMMENT ON POLICY "profiles_select_own" ON profiles IS 'profile';
COMMENT ON POLICY "profiles_insert_any" ON profiles IS 'profile';
COMMENT ON POLICY "profiles_update_own" ON profiles IS 'profile';
COMMENT ON POLICY "profiles_delete_own" ON profiles IS 'profile';
COMMENT ON POLICY "organizations_select_member" ON organizations IS '';
COMMENT ON POLICY "organizations_insert_any" ON organizations IS '';
COMMENT ON POLICY "organizations_update_member" ON organizations IS '';
COMMENT ON POLICY "organizations_delete_member" ON organizations IS '';
