-- ============================================================
-- Multi-Tenant SaaS Database Schema (Consolidated)
-- ============================================================
--
-- 統合済みスキーマ（新規プロジェクト用）
-- 12個のマイグレーションファイルを1つに統合
--
-- テナント分離の設計原則:
-- 1. 全テーブルはorg_idでテナント分離
-- 2. RLSで組織単位のアクセス制御
-- 3. 各組織にオーナーは1人のみ
-- 4. ロール階層: member < admin < owner (opsはグローバル)
-- 5. activity_logsで監査証跡を記録
--
-- ============================================================

-- ============================================================
-- 1. テーブル定義
-- ============================================================

-- organizations テーブル（テナント単位）
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'free',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- slug制約
ALTER TABLE organizations ADD CONSTRAINT organizations_slug_unique UNIQUE (slug);
ALTER TABLE organizations ADD CONSTRAINT slug_format CHECK (
  slug ~ '^[a-z0-9-]+$'
  AND slug NOT IN ('www', 'app', 'admin', 'ops', 'api', 'static', 'assets')
);

COMMENT ON TABLE organizations IS '組織マスタテーブル。is_active=falseで論理削除';
COMMENT ON COLUMN organizations.id IS '組織ID (UUID)';
COMMENT ON COLUMN organizations.name IS '組織表示名';
COMMENT ON COLUMN organizations.slug IS 'URLスラッグ（サブドメイン用）';
COMMENT ON COLUMN organizations.plan IS 'プラン: free | basic | business | enterprise';
COMMENT ON COLUMN organizations.is_active IS 'アクティブフラグ';

-- profiles テーブル（ユーザー・組織メンバーシップ）
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, org_id)
);

-- ロール制約
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('member', 'admin', 'owner', 'ops'));

COMMENT ON TABLE profiles IS 'ユーザー・組織メンバーシップ。1ユーザーは複数組織に所属可';
COMMENT ON COLUMN profiles.user_id IS 'Supabase Auth のユーザーID';
COMMENT ON COLUMN profiles.org_id IS '所属組織';
COMMENT ON COLUMN profiles.role IS 'ロール: member | admin | owner | ops';
COMMENT ON COLUMN profiles.metadata IS 'ユーザー固有のメタデータ';

-- activity_logs テーブル（監査ログ）
CREATE TABLE IF NOT EXISTS activity_logs (
  id BIGSERIAL PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  payload JSONB DEFAULT '{}',
  request_id UUID,
  session_id UUID,
  ip_address TEXT,
  user_agent TEXT,
  severity TEXT DEFAULT 'info' NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE activity_logs IS '監査ログテーブル（イミュータブル: INSERT/SELECTのみ可、UPDATE/DELETE不可）';
COMMENT ON COLUMN activity_logs.org_id IS '組織コンテキスト';
COMMENT ON COLUMN activity_logs.user_id IS '操作実行ユーザー';
COMMENT ON COLUMN activity_logs.action IS 'アクション種別';
COMMENT ON COLUMN activity_logs.payload IS '操作詳細（JSON）';
COMMENT ON COLUMN activity_logs.request_id IS 'リクエストID（分散トレーシング用）';
COMMENT ON COLUMN activity_logs.session_id IS 'セッションID';
COMMENT ON COLUMN activity_logs.ip_address IS 'クライアントIP';
COMMENT ON COLUMN activity_logs.user_agent IS 'User-Agent';
COMMENT ON COLUMN activity_logs.severity IS 'ログレベル: info, warning, critical';

-- user_org_context テーブル（現在の組織コンテキスト）
CREATE TABLE IF NOT EXISTS user_org_context (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE user_org_context IS 'ユーザーの現在の組織コンテキスト';

-- ============================================================
-- 2. インデックス
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_org_id ON profiles(org_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_org_id ON activity_logs(org_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_request_id ON activity_logs(request_id) WHERE request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activity_logs_session_id ON activity_logs(session_id) WHERE session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activity_logs_severity ON activity_logs(severity);
CREATE INDEX IF NOT EXISTS idx_user_org_context_org_id ON user_org_context(org_id);
CREATE UNIQUE INDEX IF NOT EXISTS profiles_user_org_unique ON profiles(user_id, org_id);

-- ============================================================
-- 3. イミュータブルログのトリガー
-- ============================================================

-- UPDATE防止トリガー関数
CREATE OR REPLACE FUNCTION prevent_activity_logs_update()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION '監査ログは変更できません（activity_logs is immutable）';
END;
$$ LANGUAGE plpgsql;

-- DELETE防止トリガー関数
CREATE OR REPLACE FUNCTION prevent_activity_logs_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION '監査ログは削除できません（activity_logs is immutable）';
END;
$$ LANGUAGE plpgsql;

-- UPDATEトリガー
DROP TRIGGER IF EXISTS prevent_activity_logs_update_trigger ON activity_logs;
CREATE TRIGGER prevent_activity_logs_update_trigger
  BEFORE UPDATE ON activity_logs
  FOR EACH ROW
  EXECUTE FUNCTION prevent_activity_logs_update();

-- DELETEトリガー
DROP TRIGGER IF EXISTS prevent_activity_logs_delete_trigger ON activity_logs;
CREATE TRIGGER prevent_activity_logs_delete_trigger
  BEFORE DELETE ON activity_logs
  FOR EACH ROW
  EXECUTE FUNCTION prevent_activity_logs_delete();

-- ============================================================
-- 4. Row Level Security (RLS)
-- ============================================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_org_context ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- organizations RLS
-- ------------------------------------------------------------

-- SELECT: 認証済みユーザーは全組織を参照可能
CREATE POLICY "organizations_select_authenticated"
ON organizations FOR SELECT
USING (auth.uid() IS NOT NULL);

-- INSERT: 認証済みユーザーは組織作成可能
CREATE POLICY "organizations_insert_authenticated"
ON organizations FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- UPDATE: 認証済みユーザーは更新可能（アプリ層でロールチェック）
CREATE POLICY "organizations_update_authenticated"
ON organizations FOR UPDATE
USING (auth.uid() IS NOT NULL);

-- DELETE: 認証済みユーザーは削除可能（アプリ層でロールチェック）
CREATE POLICY "organizations_delete_authenticated"
ON organizations FOR DELETE
USING (auth.uid() IS NOT NULL);

-- ------------------------------------------------------------
-- profiles RLS
-- ------------------------------------------------------------

-- SELECT: 自分のプロファイルまたは同一組織のメンバー
CREATE POLICY "profiles_select_policy"
ON profiles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles AS p
    WHERE p.user_id = auth.uid()
    AND p.role = 'ops'
  )
  OR auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM profiles AS p
    WHERE p.user_id = auth.uid()
    AND p.org_id = profiles.org_id
  )
);

-- INSERT: 認証済みユーザーはプロファイル作成可能
CREATE POLICY "profiles_insert_authenticated"
ON profiles FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- UPDATE: 自分のプロファイルのみ更新可能
CREATE POLICY "profiles_update_authenticated"
ON profiles FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- DELETE: 自分のプロファイルのみ削除可能
CREATE POLICY "profiles_delete_authenticated"
ON profiles FOR DELETE
USING (user_id = auth.uid());

-- ------------------------------------------------------------
-- activity_logs RLS
-- ------------------------------------------------------------

-- SELECT: 認証済みユーザーは参照可能
CREATE POLICY "activity_logs_select_authenticated"
ON activity_logs FOR SELECT
USING (auth.uid() IS NOT NULL);

-- INSERT: 認証済みユーザーは挿入可能
CREATE POLICY "activity_logs_insert_authenticated"
ON activity_logs FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- ------------------------------------------------------------
-- user_org_context RLS
-- ------------------------------------------------------------

-- SELECT: 自分のコンテキストのみ
CREATE POLICY "Users can view own context"
ON user_org_context FOR SELECT
USING (auth.uid() = user_id);

-- UPDATE: 自分のコンテキストかつ所属組織のみ
CREATE POLICY "Users can update own context to member orgs only"
ON user_org_context FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid()
    AND p.org_id = user_org_context.org_id
  )
);

-- INSERT: 自分のコンテキストかつ所属組織のみ
CREATE POLICY "Users can insert own context for member orgs only"
ON user_org_context FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid()
    AND p.org_id = user_org_context.org_id
  )
);
