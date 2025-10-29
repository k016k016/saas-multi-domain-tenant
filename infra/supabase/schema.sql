-- ============================================================
-- Multi-Tenant SaaS Database Schema
-- ============================================================
--
-- このスキーマはマルチテナントSaaSのためのものです。
-- 以下の原則を厳守してください:
--
-- 1. マルチテナント前提
--    - すべてのデータ行は org_id でスコープされる
--    - 各ユーザーは複数組織(org)に所属できる
--    - アクティブな org_id がアプリ全体のコンテキストになる
--
-- 2. Row Level Security (RLS)
--    - RLS は必須であり、RLS をオフにして全件見る等は許容しない
--    - org_id 単位でデータアクセスを制御する
--    - ユーザーが所属していない org_id のデータは一切見えない
--
-- 3. owner 制約
--    - 各組織には owner が必ず1人必要
--    - owner は削除不可
--    - owner 交代は「譲渡」のみ許可（新オーナー指名→元オーナー降格）
--
-- 4. ロール階層
--    - member ⊂ admin ⊂ owner (ops は別枠)
--    - この階層は固定であり、変更・追加・統合は禁止
--
-- 5. 監査ログ (activity_logs)
--    - 以下の操作は必ず activity_logs に記録する:
--      - 組織切替
--      - admin によるユーザーCRUD / ロール変更
--      - owner による支払い変更・組織凍結/廃止・owner譲渡
--
-- ============================================================

-- organizations テーブル
-- 組織(テナント)の基本情報を管理
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'free', -- 'free' | 'basic' | 'business' | 'enterprise'
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE organizations IS '組織(テナント)テーブル。各組織は is_active=true でアクティブ、false で凍結状態。';
COMMENT ON COLUMN organizations.id IS '組織の一意識別子';
COMMENT ON COLUMN organizations.name IS '組織名';
COMMENT ON COLUMN organizations.plan IS 'サブスクリプションプラン';
COMMENT ON COLUMN organizations.is_active IS '組織の状態。false の場合は凍結中でアクセス不可。';

-- profiles テーブル
-- ユーザーと組織の関連、およびロールを管理
-- 1ユーザーは複数組織に所属できるため、(user_id, org_id) の組み合わせでロールを管理
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL, -- Supabase Auth の auth.users.id を参照する想定
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('member', 'admin', 'owner', 'ops')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, org_id)
);

COMMENT ON TABLE profiles IS 'ユーザーと組織の関連テーブル。1ユーザーは複数組織に所属可能で、各組織ごとに異なるロールを持つ。';
COMMENT ON COLUMN profiles.user_id IS 'Supabase Auth の auth.users.id を参照';
COMMENT ON COLUMN profiles.org_id IS '所属する組織のID';
COMMENT ON COLUMN profiles.role IS 'ロール: member | admin | owner | ops。階層: member ⊂ admin ⊂ owner';
COMMENT ON COLUMN profiles.metadata IS '追加のユーザーメタデータ（JSON形式）';

-- 各組織には owner が必ず1人必要（アプリケーションレベルで制御）
-- owner の削除は禁止（アプリケーションレベルで制御）
-- owner 交代は譲渡のみ（新オーナー指名→元オーナーを admin に降格）

-- activity_logs テーブル
-- 監査ログ。重要な操作を記録する
CREATE TABLE IF NOT EXISTS activity_logs (
  id BIGSERIAL PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL, -- 操作を行ったユーザー
  action TEXT NOT NULL, -- 'org_switch' | 'user_created' | 'user_role_changed' | 'payment_updated' | 'org_suspended' | 'owner_transferred' 等
  payload JSONB DEFAULT '{}', -- 操作の詳細情報
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE activity_logs IS '監査ログテーブル。組織切替、ユーザー管理、重要な設定変更などを記録。';
COMMENT ON COLUMN activity_logs.org_id IS '操作対象の組織ID';
COMMENT ON COLUMN activity_logs.user_id IS '操作を行ったユーザーID';
COMMENT ON COLUMN activity_logs.action IS '操作の種類（org_switch, user_created, payment_updated など）';
COMMENT ON COLUMN activity_logs.payload IS '操作の詳細情報（JSON形式）';

-- インデックス
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_org_id ON profiles(org_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_org_id ON activity_logs(org_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);

-- ============================================================
-- Row Level Security (RLS) Policies
-- ============================================================
--
-- org_id ベースのマルチテナント隔離を実現する RLS ポリシー。
-- 別組織のレコードはDBレベルで完全に弾かれる。
--
-- 重要な原則:
-- - RLS を無効化・バイパスする実装は許可しない
-- - org_id 単位のアクセス制御は必須
-- - 開発中も RLS を OFF にすることは禁止
-- - ops ロールは特殊ロールとして全組織のデータにアクセス可能
--
-- ============================================================

-- RLS を有効化
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- 1. organizations テーブルの RLS ポリシー
-- ------------------------------------------------------------

-- 【SELECT】ユーザーが profiles 経由で所属している org のみ読み取り可能
-- ops ロールは全組織にアクセス可能
CREATE POLICY "organizations_select_policy"
ON organizations
FOR SELECT
USING (
  -- ops ロールの場合は全組織にアクセス可能
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role = 'ops'
  )
  OR
  -- 通常ユーザーは自分が所属する組織のみ
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.org_id = organizations.id
  )
);

-- 【UPDATE】admin 以上のロールのみ更新可能
CREATE POLICY "organizations_update_policy"
ON organizations
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.org_id = organizations.id
    AND profiles.role IN ('admin', 'owner', 'ops')
  )
);

-- 【INSERT】ops ロールのみ新規組織を作成可能
CREATE POLICY "organizations_insert_policy"
ON organizations
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role = 'ops'
  )
);

-- 【DELETE】ops ロールのみ組織を削除可能
CREATE POLICY "organizations_delete_policy"
ON organizations
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role = 'ops'
  )
);

-- ------------------------------------------------------------
-- 2. profiles テーブルの RLS ポリシー
-- ------------------------------------------------------------

-- 【SELECT】自分が所属している org のプロフィールのみ読み取り可能
-- ops ロールは全プロフィールにアクセス可能
CREATE POLICY "profiles_select_policy"
ON profiles
FOR SELECT
USING (
  -- ops ロールの場合は全プロフィールにアクセス可能
  EXISTS (
    SELECT 1 FROM profiles AS p
    WHERE p.user_id = auth.uid()
    AND p.role = 'ops'
  )
  OR
  -- 通常ユーザーは自分が所属する組織のプロフィールのみ
  EXISTS (
    SELECT 1 FROM profiles AS p
    WHERE p.user_id = auth.uid()
    AND p.org_id = profiles.org_id
  )
);

-- 【INSERT】admin 以上のロールのみ新規プロフィールを作成可能
CREATE POLICY "profiles_insert_policy"
ON profiles
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles AS p
    WHERE p.user_id = auth.uid()
    AND p.org_id = profiles.org_id
    AND p.role IN ('admin', 'owner', 'ops')
  )
);

-- 【UPDATE】admin 以上のロールのみ更新可能
CREATE POLICY "profiles_update_policy"
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

-- 【DELETE】admin 以上のロールのみ削除可能
-- 注意: owner の削除はアプリケーションレベルで禁止（この RLS では制御しない）
CREATE POLICY "profiles_delete_policy"
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
-- 3. activity_logs テーブルの RLS ポリシー
-- ------------------------------------------------------------

-- 【SELECT】自分が所属している org のログのみ読み取り可能
-- ops ロールは全ログにアクセス可能
CREATE POLICY "activity_logs_select_policy"
ON activity_logs
FOR SELECT
USING (
  -- ops ロールの場合は全ログにアクセス可能
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role = 'ops'
  )
  OR
  -- 通常ユーザーは自分が所属する組織のログのみ
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.org_id = activity_logs.org_id
  )
);

-- 【INSERT】すべての認証済みユーザーがログを挿入可能
-- （自分が所属する組織のログのみ）
CREATE POLICY "activity_logs_insert_policy"
ON activity_logs
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.org_id = activity_logs.org_id
  )
);

-- 【UPDATE】禁止（監査ログの改ざん防止）
-- ポリシーを作成しないことで UPDATE を禁止

-- 【DELETE】禁止（監査ログの改ざん防止）
-- ポリシーを作成しないことで DELETE を禁止

-- ============================================================
-- 初期データ（開発用）
-- ============================================================
-- 本番環境では削除すること

-- サンプル組織
INSERT INTO organizations (id, name, plan, is_active) VALUES
  ('org_dummy_12345', 'サンプル組織A', 'business', true),
  ('org_dummy_67890', 'サンプル組織B', 'free', true)
ON CONFLICT DO NOTHING;
