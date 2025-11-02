-- user_org_context RLS脆弱性の修正
--
-- 問題点:
--   既存のUPDATE/INSERTポリシーにWITH CHECK制約がないため、
--   ユーザーは自分が所属していない組織のorg_idを設定できてしまう。
--
-- 対策:
--   1. WITH CHECKで所属組織のみを許可するよう制約を追加
--   2. profiles テーブルにUNIQUE制約を追加（重複防止）

-- ============================================================
-- 1. 既存のポリシーを削除
-- ============================================================

DROP POLICY IF EXISTS "Users can update own context" ON user_org_context;
DROP POLICY IF EXISTS "Users can insert own context" ON user_org_context;

-- ============================================================
-- 2. 所属組織チェック付きのポリシーを再作成
-- ============================================================

-- UPDATE: ユーザーは自分の所属組織のみを設定可能
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

-- INSERT: ユーザーは自分の所属組織のみを挿入可能
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
-- 3. profiles テーブルに整合性制約を追加
-- ============================================================

-- 同じユーザーが同じ組織に重複して所属できないようにする
CREATE UNIQUE INDEX IF NOT EXISTS profiles_user_org_unique
ON profiles(user_id, org_id);

-- ============================================================
-- 4. 検証用コメント
-- ============================================================

-- この修正により、以下が保証される:
-- ✅ ユーザーは自分が所属する組織のみをuser_org_contextに設定できる
-- ✅ 不正なorg_idでの切り替えはDB層で拒否される
-- ✅ profilesの重複エントリが防止される
