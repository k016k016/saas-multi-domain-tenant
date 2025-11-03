-- profiles_select_policy の修正
--
-- 問題: 既存のポリシーは「同じ組織のプロファイルにアクセス可能」という制限だったため、
--       ユーザーが所属する全ての組織を取得できなかった
--
-- 解決策: ユーザーは自分の全てのプロファイル（全ての組織への所属情報）を閲覧可能にする

-- 既存のポリシーを削除
DROP POLICY IF EXISTS "profiles_select_policy" ON profiles;

-- 新しいポリシーを作成
CREATE POLICY "profiles_select_policy"
ON profiles
FOR SELECT
USING (
  -- ops ロールは全てのプロファイルにアクセス可能
  EXISTS (
    SELECT 1 FROM profiles AS p
    WHERE p.user_id = auth.uid()
    AND p.role = 'ops'
  )
  OR
  -- 認証済みユーザーは自分のプロファイルを全て閲覧可能（組織切替で必要）
  auth.uid() = user_id
  OR
  -- 認証済みユーザーは同じ組織の他のユーザーのプロファイルにアクセス可能
  EXISTS (
    SELECT 1 FROM profiles AS p
    WHERE p.user_id = auth.uid()
    AND p.org_id = profiles.org_id
  )
);
