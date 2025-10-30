-- ============================================================
-- Fix activity_logs RLS - Complete Fix
-- ============================================================
--
-- 根本原因:
-- activity_logs_select_policy が profiles テーブルを参照し、
-- これがprofiles参照時に無限再帰を引き起こしている
--
-- 解決策:
-- activity_logsのRLSポリシーも完全に単純化する
-- ============================================================

-- 既存の activity_logs ポリシーを削除
DROP POLICY IF EXISTS "activity_logs_select_policy" ON activity_logs;
DROP POLICY IF EXISTS "activity_logs_insert_policy" ON activity_logs;

-- ------------------------------------------------------------
-- 新しい activity_logs テーブルの RLS ポリシー - 完全に単純化
-- ------------------------------------------------------------

-- SELECT: 認証済みユーザーは全てのactivity_logsを読める
-- (詳細な制限はアプリケーション層で)
CREATE POLICY "activity_logs_select_authenticated"
ON activity_logs
FOR SELECT
USING (
  auth.uid() IS NOT NULL
);

-- INSERT: 認証済みユーザーはactivity_logsを作成できる
CREATE POLICY "activity_logs_insert_authenticated"
ON activity_logs
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
);

COMMENT ON POLICY "activity_logs_select_authenticated" ON activity_logs IS '認証済みユーザーは全てのactivity_logsを読める（組織チェックはアプリ層で）';
COMMENT ON POLICY "activity_logs_insert_authenticated" ON activity_logs IS '認証済みユーザーはactivity_logsを作成できる';
