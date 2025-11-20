-- profiles テーブルの role CHECK 制約を修正
-- ops ロールを許可するように更新

-- 既存の制約を削除
ALTER TABLE profiles
DROP CONSTRAINT IF EXISTS profiles_role_check;

-- 新しい制約を追加（ops を含む）
ALTER TABLE profiles
ADD CONSTRAINT profiles_role_check CHECK (role IN ('member', 'admin', 'owner', 'ops'));

COMMENT ON CONSTRAINT profiles_role_check ON profiles IS 'ロールの値を member, admin, owner, ops のいずれかに制限';
