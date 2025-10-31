-- user_org_context: ユーザーの現在アクティブな組織を記録
-- Cookie に org_id を持たず、DB で管理する設計

CREATE TABLE IF NOT EXISTS user_org_context (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- インデックス: org_id での検索を高速化
CREATE INDEX idx_user_org_context_org_id ON user_org_context(org_id);

-- RLS有効化
ALTER TABLE user_org_context ENABLE ROW LEVEL SECURITY;

-- ポリシー: 自分のコンテキストのみ参照・更新可能
CREATE POLICY "Users can view own context"
  ON user_org_context
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own context"
  ON user_org_context
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own context"
  ON user_org_context
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 既存ユーザーのデフォルト組織を挿入
-- profiles の最初の組織（created_at が最も古い）を active org として設定
INSERT INTO user_org_context (user_id, org_id, updated_at)
SELECT DISTINCT ON (p.user_id)
  p.user_id,
  p.org_id,
  now()
FROM profiles p
ORDER BY p.user_id, p.created_at ASC
ON CONFLICT (user_id) DO NOTHING;
