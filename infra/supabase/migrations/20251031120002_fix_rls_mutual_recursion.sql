-- ============================================================
-- Fix RLS Mutual Recursion - Definitive Fix
-- ============================================================
--
-- 根本原因:
-- - organizations_select_member ポリシーが profiles テーブルを参照
-- - profiles_select_own ポリシーは再帰していないが、
--   クエリ実行時に organizationsテーブルも参照される可能性がある
-- - これにより相互参照による無限再帰が発生
--
-- 解決策:
-- RLSポリシーを完全に単純化し、相互参照を完全に削除します。
-- - 認証済みユーザーは自分自身の profiles を読める（organizations 参照なし）
-- - 認証済みユーザーは全ての organizations を読める（profiles 参照なし）
-- - セキュリティ制限はアプリケーション層で行う
-- ============================================================

-- 既存のポリシーを全て削除
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_any" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
DROP POLICY IF EXISTS "profiles_delete_own" ON profiles;

DROP POLICY IF EXISTS "organizations_select_member" ON organizations;
DROP POLICY IF EXISTS "organizations_insert_any" ON organizations;
DROP POLICY IF EXISTS "organizations_update_member" ON organizations;
DROP POLICY IF EXISTS "organizations_delete_member" ON organizations;

DROP POLICY IF EXISTS "organizations_update_policy" ON organizations;
DROP POLICY IF EXISTS "organizations_insert_policy" ON organizations;
DROP POLICY IF EXISTS "organizations_delete_policy" ON organizations;

-- ------------------------------------------------------------
-- 新しい profiles テーブルの RLS ポリシー - 完全に単純化
-- ------------------------------------------------------------

-- SELECT: 認証済みユーザーは自分自身の全てのprofileを読める
CREATE POLICY "profiles_select_authenticated"
ON profiles
FOR SELECT
USING (
  -- 自分のuser_idのprofileのみ読める
  user_id = auth.uid()
);

-- INSERT: 認証済みユーザーは profile を作成できる
CREATE POLICY "profiles_insert_authenticated"
ON profiles
FOR INSERT
WITH CHECK (
  -- 認証済みユーザーなら作成可能
  auth.uid() IS NOT NULL
);

-- UPDATE: 自分自身のprofileのみ更新できる
CREATE POLICY "profiles_update_authenticated"
ON profiles
FOR UPDATE
USING (
  user_id = auth.uid()
)
WITH CHECK (
  user_id = auth.uid()
);

-- DELETE: 自分自身のprofileのみ削除できる
CREATE POLICY "profiles_delete_authenticated"
ON profiles
FOR DELETE
USING (
  user_id = auth.uid()
);

-- ------------------------------------------------------------
-- organizations テーブルの RLS ポリシー - 完全に単純化
-- ------------------------------------------------------------

-- SELECT: 認証済みユーザーは全ての組織を読める
-- (どの組織に所属しているかはprofilesテーブルで判断)
CREATE POLICY "organizations_select_authenticated"
ON organizations
FOR SELECT
USING (
  -- 認証済みなら全て読める（詳細な制限はアプリケーション層で）
  auth.uid() IS NOT NULL
);

-- INSERT: 認証済みユーザーは組織を作成できる
CREATE POLICY "organizations_insert_authenticated"
ON organizations
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
);

-- UPDATE: 認証済みユーザーは組織を更新できる
-- (権限チェックはアプリケーション層で行う)
CREATE POLICY "organizations_update_authenticated"
ON organizations
FOR UPDATE
USING (
  auth.uid() IS NOT NULL
);

-- DELETE: 認証済みユーザーは組織を削除できる
-- (権限チェックはアプリケーション層で行う)
CREATE POLICY "organizations_delete_authenticated"
ON organizations
FOR DELETE
USING (
  auth.uid() IS NOT NULL
);

COMMENT ON POLICY "profiles_select_authenticated" ON profiles IS '認証済みユーザーは自分自身の全てのprofileを読める';
COMMENT ON POLICY "profiles_insert_authenticated" ON profiles IS '認証済みユーザーはprofileを作成できる';
COMMENT ON POLICY "profiles_update_authenticated" ON profiles IS '自分自身のprofileのみ更新できる';
COMMENT ON POLICY "profiles_delete_authenticated" ON profiles IS '自分自身のprofileのみ削除できる';
COMMENT ON POLICY "organizations_select_authenticated" ON organizations IS '認証済みユーザーは全ての組織を読める（所属チェックはアプリ層で）';
COMMENT ON POLICY "organizations_insert_authenticated" ON organizations IS '認証済みユーザーは組織を作成できる';
COMMENT ON POLICY "organizations_update_authenticated" ON organizations IS '認証済みユーザーは組織を更新できる（権限チェックはアプリ層で）';
COMMENT ON POLICY "organizations_delete_authenticated" ON organizations IS '認証済みユーザーは組織を削除できる（権限チェックはアプリ層で）';
