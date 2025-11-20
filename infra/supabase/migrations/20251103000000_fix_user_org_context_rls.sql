-- user_org_context RLS
--
-- :
--   UPDATE/INSERTWITH CHECK
--   org_id
--
-- :
--   1. WITH CHECK
--   2. profiles UNIQUE

-- ============================================================
-- 1. 
-- ============================================================

DROP POLICY IF EXISTS "Users can update own context" ON user_org_context;
DROP POLICY IF EXISTS "Users can insert own context" ON user_org_context;

-- ============================================================
-- 2. 
-- ============================================================

-- UPDATE: 
CREATE POLICY "Users can update own context to member orgs only"
ON user_org_context
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid()
    AND p.org_id = user_org_context.org_id
  )
);

-- INSERT: 
CREATE POLICY "Users can insert own context for member orgs only"
ON user_org_context
FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid()
    AND p.org_id = user_org_context.org_id
  )
);

-- ============================================================
-- 3. profiles 
-- ============================================================

-- 
CREATE UNIQUE INDEX IF NOT EXISTS profiles_user_org_unique
ON profiles(user_id, org_id);

-- ============================================================
-- 4. 
-- ============================================================

-- :
--  user_org_context
--  org_idDB
--  profiles
