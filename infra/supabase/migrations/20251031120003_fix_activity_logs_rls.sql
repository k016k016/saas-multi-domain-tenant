-- ============================================================
-- Fix activity_logs RLS - Complete Fix
-- ============================================================
--
-- :
-- activity_logs_select_policy  profiles 
-- profiles
--
-- :
-- activity_logsRLS
-- ============================================================

--  activity_logs 
DROP POLICY IF EXISTS "activity_logs_select_policy" ON activity_logs;
DROP POLICY IF EXISTS "activity_logs_insert_policy" ON activity_logs;

-- ------------------------------------------------------------
--  activity_logs  RLS  - 
-- ------------------------------------------------------------

-- SELECT: activity_logs
-- ()
CREATE POLICY "activity_logs_select_authenticated"
ON activity_logs
FOR SELECT
USING (
  auth.uid() IS NOT NULL
);

-- INSERT: activity_logs
CREATE POLICY "activity_logs_insert_authenticated"
ON activity_logs
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
);

COMMENT ON POLICY "activity_logs_select_authenticated" ON activity_logs IS 'activity_logs';
COMMENT ON POLICY "activity_logs_insert_authenticated" ON activity_logs IS 'activity_logs';
