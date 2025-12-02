-- profiles_select_policy 
--
-- : 
--       
--
-- : 

-- 
DROP POLICY IF EXISTS "profiles_select_policy" ON profiles;

-- 
CREATE POLICY "profiles_select_policy"
ON profiles
FOR SELECT
USING (
  -- ops 
  EXISTS (
    SELECT 1 FROM profiles AS p
    WHERE p.user_id = auth.uid()
    AND p.role = 'ops'
  )
  OR
  -- 
  auth.uid() = user_id
  OR
  -- 
  EXISTS (
    SELECT 1 FROM profiles AS p
    WHERE p.user_id = auth.uid()
    AND p.org_id = profiles.org_id
  )
);
