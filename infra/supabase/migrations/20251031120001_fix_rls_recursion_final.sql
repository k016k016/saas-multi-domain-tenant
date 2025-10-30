-- ============================================================
-- Fix RLS Infinite Recursion - Final Fix
-- ============================================================
--
-- 問題:
-- 前回のマイグレーションでは、まだ profiles_select_ops ポリシーが
-- profiles テーブル自身を参照していたため、無限再帰が発生していました。
--
-- 解決策:
-- RLSポリシーを完全に単純化し、再帰参照を完全に削除します。
-- - 認証済みユーザーは自分自身のprofileを常に読める
-- - INSERT/UPDATE/DELETEは自分自身のprofileのみ、または別の制御メカニズムで
-- ============================================================

-- 既存のポリシーを全て削除
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
DROP POLICY IF EXISTS "profiles_select_ops" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_admin" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
DROP POLICY IF EXISTS "profiles_update_admin" ON profiles;
DROP POLICY IF EXISTS "profiles_delete_admin" ON profiles;

DROP POLICY IF EXISTS "organizations_select_member" ON organizations;
DROP POLICY IF EXISTS "organizations_select_ops" ON organizations;

-- ------------------------------------------------------------
-- 新しい profiles テーブルの RLS ポリシー - 完全に再帰なし
-- ------------------------------------------------------------

-- SELECT: 認証済みユーザーは自分自身のprofileをすべて読める
-- これにより、ログイン後にCookie設定のためのprofile取得が可能になります
-- 複数組織に所属している場合も、すべてのprofileを取得できます
CREATE POLICY "profiles_select_own"
ON profiles
FOR SELECT
USING (
  -- 自分自身のprofileは常に読める（再帰なし）
  user_id = auth.uid()
);

-- INSERT: 認証済みユーザーは新しいprofileを作成できる
-- (組織への参加は別のビジネスロジックで制御される)
CREATE POLICY "profiles_insert_any"
ON profiles
FOR INSERT
WITH CHECK (
  -- 認証済みユーザーならprofileを作成できる
  auth.uid() IS NOT NULL
);

-- UPDATE: 自分自身のprofileのみ更新できる
CREATE POLICY "profiles_update_own"
ON profiles
FOR UPDATE
USING (
  user_id = auth.uid()
)
WITH CHECK (
  user_id = auth.uid()
);

-- DELETE: 自分自身のprofileのみ削除できる
CREATE POLICY "profiles_delete_own"
ON profiles
FOR DELETE
USING (
  user_id = auth.uid()
);

-- ------------------------------------------------------------
-- organizations テーブルの RLS ポリシー - 再帰なし
-- ------------------------------------------------------------

-- SELECT: 自分が所属する組織は読める（profiles参照はOK、再帰ではないため）
CREATE POLICY "organizations_select_member"
ON organizations
FOR SELECT
USING (
  -- profilesを参照するが、profiles自身がorganizationsを再帰的に参照していないのでOK
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.org_id = organizations.id
  )
);

-- INSERT: 認証済みユーザーは組織を作成できる
-- (実際には、ops roleでのチェックはアプリケーション層で行う)
CREATE POLICY "organizations_insert_any"
ON organizations
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
);

-- UPDATE: 自分が所属する組織は更新できる
-- (roleに基づく制限はアプリケーション層で行う)
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

-- DELETE: 自分が所属する組織は削除できる
-- (roleに基づく制限はアプリケーション層で行う)
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

COMMENT ON POLICY "profiles_select_own" ON profiles IS '認証済みユーザーは自分自身のすべてのprofileを読める（再帰なし）';
COMMENT ON POLICY "profiles_insert_any" ON profiles IS '認証済みユーザーはprofileを作成できる';
COMMENT ON POLICY "profiles_update_own" ON profiles IS '自分自身のprofileのみ更新できる';
COMMENT ON POLICY "profiles_delete_own" ON profiles IS '自分自身のprofileのみ削除できる';
COMMENT ON POLICY "organizations_select_member" ON organizations IS '自分が所属する組織は読める（再帰なし）';
COMMENT ON POLICY "organizations_insert_any" ON organizations IS '認証済みユーザーは組織を作成できる';
COMMENT ON POLICY "organizations_update_member" ON organizations IS '自分が所属する組織は更新できる';
COMMENT ON POLICY "organizations_delete_member" ON organizations IS '自分が所属する組織は削除できる';
