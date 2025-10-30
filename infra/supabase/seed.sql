-- ============================================================
-- Development Seed Data
-- ============================================================
-- 開発環境用のサンプルデータ
-- 本番環境では実行しないこと
--
-- 実行方法:
-- 1. Supabase Studio の SQL Editor で実行
-- 2. または: psql -h <host> -U postgres -d postgres -f seed.sql
--
-- 注意:
-- - このスクリプトは既存データを削除します
-- - RLSポリシーの影響を受けるため、適切な権限で実行してください
-- - 開発環境でのみ使用すること
-- ============================================================

-- 既存データをクリア（外部キー制約の順序に注意）
DELETE FROM activity_logs;
DELETE FROM profiles;
DELETE FROM organizations;

-- サンプル組織を登録
INSERT INTO organizations (id, name, plan, is_active) VALUES
  ('00000000-0000-0000-0000-000000000001', 'サンプル組織A', 'business', true),
  ('00000000-0000-0000-0000-000000000002', 'サンプル組織B', 'free', true);

-- 完了メッセージ
DO $$
BEGIN
  RAISE NOTICE 'Seed data inserted successfully!';
  RAISE NOTICE '- 2 organizations created';
END $$;
