-- user_org_context: 
-- Cookie  org_id DB 

CREATE TABLE IF NOT EXISTS user_org_context (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- : org_id 
CREATE INDEX idx_user_org_context_org_id ON user_org_context(org_id);

-- RLS
ALTER TABLE user_org_context ENABLE ROW LEVEL SECURITY;

-- : 
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

-- 
-- profiles created_at  active org 
INSERT INTO user_org_context (user_id, org_id, updated_at)
SELECT DISTINCT ON (p.user_id)
  p.user_id,
  p.org_id,
  now()
FROM profiles p
ORDER BY p.user_id, p.created_at ASC
ON CONFLICT (user_id) DO NOTHING;
