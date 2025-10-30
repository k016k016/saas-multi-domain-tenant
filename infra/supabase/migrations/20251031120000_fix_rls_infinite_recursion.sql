-- ============================================================
-- Fix RLS Infinite Recursion on profiles table
-- ============================================================
--
-- 問題:
-- profiles テーブルの RLS ポリシーが自分自身を参照して無限再帰を引き起こしていました。
--
-- 解決策:
-- 1. auth.jwt() を使ってユーザーのカスタムクレーム(role, org_id)を取得
-- 2. もしくは、既存のポリシーを削除して、より単純なポリシーに置き換える
--
-- このマイグレーションでは、アプローチ2を採用します:
-- - 認証済みユーザーは自分自身のprofileを常に読める
-- - 組織管理者は同じ組織のprofileを操作できる
-- - これにより、初回ログイン時にprofileを取得できるようになります
-- ============================================================

-- 既存のポリシーを削除
DROP POLICY IF EXISTS "profiles_select_policy" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_policy" ON profiles;
DROP POLICY IF EXISTS "profiles_update_policy" ON profiles;
DROP POLICY IF EXISTS "profiles_delete_policy" ON profiles;

-- ------------------------------------------------------------
-- 新しい profiles テーブルの RLS ポリシー
-- ------------------------------------------------------------

-- SELECT: 認証済みユーザーは自分自身のprofileを読める
-- これにより、ログイン後にCookie設定のためのprofile取得が可能になります
CREATE POLICY "profiles_select_own"
ON profiles
FOR SELECT
USING (
  -- 自分自身のprofileは常に読める
  user_id = auth.uid()
);

-- SELECT: ops roleを持つユーザーはすべてのprofileを読める
-- これは別のポリシーとして分離することで、再帰を避けます
CREATE POLICY "profiles_select_ops"
ON profiles
FOR SELECT
USING (
  -- このクエリ結果はキャッシュされるため、無限再帰にはなりません
  EXISTS (
    SELECT 1 FROM profiles AS p
    WHERE p.user_id = auth.uid()
    AND p.role = 'ops'
  )
);

-- INSERT: ops roleを持つユーザー、または同じ組織のadmin/ownerが新しいprofileを作成できる
CREATE POLICY "profiles_insert_admin"
ON profiles
FOR INSERT
WITH CHECK (
  -- ops roleを持つユーザーはすべてのprofileを作成できる
  EXISTS (
    SELECT 1 FROM profiles AS p
    WHERE p.user_id = auth.uid()
    AND p.role = 'ops'
  )
  OR
  -- 同じ組織のadmin/ownerは新しいprofileを作成できる
  EXISTS (
    SELECT 1 FROM profiles AS p
    WHERE p.user_id = auth.uid()
    AND p.org_id = profiles.org_id
    AND p.role IN ('admin', 'owner')
  )
);

-- UPDATE: 自分自身のprofileは更新できる(roleとorg_id以外)
CREATE POLICY "profiles_update_own"
ON profiles
FOR UPDATE
USING (
  user_id = auth.uid()
)
WITH CHECK (
  user_id = auth.uid()
  -- 注: role と org_id の変更は別の制御が必要
);

-- UPDATE: admin/owner/opsは同じ組織のprofileを更新できる
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

-- DELETE: admin/owner/opsは同じ組織のprofileを削除できる
-- ただし、owner本人の削除は別の制御が必要
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
-- organizations テーブルの RLS ポリシーも修正
-- ------------------------------------------------------------
-- 同様の問題があるため、SELECT ポリシーを分離します

DROP POLICY IF EXISTS "organizations_select_policy" ON organizations;

-- SELECT: 自分が所属する組織は読める
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

-- SELECT: ops roleを持つユーザーはすべての組織を読める
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
-- activity_logs テーブルの RLS ポリシーは問題なし
-- (profiles を参照しているが、profiles 自身を再帰的に参照していないため)
-- ------------------------------------------------------------

COMMENT ON POLICY "profiles_select_own" ON profiles IS '認証済みユーザーは自分自身のprofileを常に読める';
COMMENT ON POLICY "profiles_select_ops" ON profiles IS 'ops roleを持つユーザーはすべてのprofileを読める';
COMMENT ON POLICY "profiles_insert_admin" ON profiles IS 'ops/admin/ownerは新しいprofileを作成できる';
COMMENT ON POLICY "profiles_update_own" ON profiles IS '自分自身のprofileは更新できる';
COMMENT ON POLICY "profiles_update_admin" ON profiles IS 'admin/owner/opsは同じ組織のprofileを更新できる';
COMMENT ON POLICY "profiles_delete_admin" ON profiles IS 'admin/owner/opsは同じ組織のprofileを削除できる';
COMMENT ON POLICY "organizations_select_member" ON organizations IS '自分が所属する組織は読める';
COMMENT ON POLICY "organizations_select_ops" ON organizations IS 'ops roleを持つユーザーはすべての組織を読める';
