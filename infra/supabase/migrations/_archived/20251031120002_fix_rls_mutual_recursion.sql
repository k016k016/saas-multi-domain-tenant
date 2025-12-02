-- ============================================================
-- Fix RLS Mutual Recursion - Definitive Fix
-- ============================================================
--
-- :
-- - organizations_select_member  profiles 
-- - profiles_select_own 
--    organizations
-- - 
--
-- :
-- RLS
-- -  profiles organizations 
-- -  organizations profiles 
-- - 
-- ============================================================

-- Drop existing policies before recreating
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_any" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
DROP POLICY IF EXISTS "profiles_delete_own" ON profiles;
DROP POLICY IF EXISTS "profiles_select_authenticated" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_authenticated" ON profiles;
DROP POLICY IF EXISTS "profiles_update_authenticated" ON profiles;
DROP POLICY IF EXISTS "profiles_delete_authenticated" ON profiles;

DROP POLICY IF EXISTS "organizations_select_member" ON organizations;
DROP POLICY IF EXISTS "organizations_insert_any" ON organizations;
DROP POLICY IF EXISTS "organizations_update_member" ON organizations;
DROP POLICY IF EXISTS "organizations_delete_member" ON organizations;
DROP POLICY IF EXISTS "organizations_update_policy" ON organizations;
DROP POLICY IF EXISTS "organizations_insert_policy" ON organizations;
DROP POLICY IF EXISTS "organizations_delete_policy" ON organizations;
DROP POLICY IF EXISTS "organizations_select_authenticated" ON organizations;
DROP POLICY IF EXISTS "organizations_insert_authenticated" ON organizations;
DROP POLICY IF EXISTS "organizations_update_authenticated" ON organizations;
DROP POLICY IF EXISTS "organizations_delete_authenticated" ON organizations;

-- ------------------------------------------------------------
--  profiles  RLS  - 
-- ------------------------------------------------------------

-- SELECT: profile
CREATE POLICY "profiles_select_authenticated"
ON profiles
FOR SELECT
USING (
  -- user_idprofile
  user_id = auth.uid()
);

-- INSERT:  profile 
CREATE POLICY "profiles_insert_authenticated"
ON profiles
FOR INSERT
WITH CHECK (
  -- 
  auth.uid() IS NOT NULL
);

-- UPDATE: profile
CREATE POLICY "profiles_update_authenticated"
ON profiles
FOR UPDATE
USING (
  user_id = auth.uid()
)
WITH CHECK (
  user_id = auth.uid()
);

-- DELETE: profile
CREATE POLICY "profiles_delete_authenticated"
ON profiles
FOR DELETE
USING (
  user_id = auth.uid()
);

-- ------------------------------------------------------------
-- organizations  RLS  - 
-- ------------------------------------------------------------

-- SELECT: 
-- (profiles)
CREATE POLICY "organizations_select_authenticated"
ON organizations
FOR SELECT
USING (
  -- 
  auth.uid() IS NOT NULL
);

-- INSERT: 
CREATE POLICY "organizations_insert_authenticated"
ON organizations
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
);

-- UPDATE: 
-- ()
CREATE POLICY "organizations_update_authenticated"
ON organizations
FOR UPDATE
USING (
  auth.uid() IS NOT NULL
);

-- DELETE: 
-- ()
CREATE POLICY "organizations_delete_authenticated"
ON organizations
FOR DELETE
USING (
  auth.uid() IS NOT NULL
);

COMMENT ON POLICY "profiles_select_authenticated" ON profiles IS 'profile';
COMMENT ON POLICY "profiles_insert_authenticated" ON profiles IS 'profile';
COMMENT ON POLICY "profiles_update_authenticated" ON profiles IS 'profile';
COMMENT ON POLICY "profiles_delete_authenticated" ON profiles IS 'profile';
COMMENT ON POLICY "organizations_select_authenticated" ON organizations IS '';
COMMENT ON POLICY "organizations_insert_authenticated" ON organizations IS '';
COMMENT ON POLICY "organizations_update_authenticated" ON organizations IS '';
COMMENT ON POLICY "organizations_delete_authenticated" ON organizations IS '';
