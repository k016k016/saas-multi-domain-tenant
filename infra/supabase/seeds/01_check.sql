-- ============================================================
-- E2E Test Setup: Schema Check
-- ============================================================
-- 目的: profiles/organizations の制約・RLS状態を確認
-- 実行: Supabase SQL Editor または psql で実行

-- profiles/organizations の制約を一覧
SELECT
  n.nspname AS schema,
  t.relname AS table,
  c.conname,
  c.contype,
  pg_get_constraintdef(c.oid) AS definition
FROM pg_constraint c
JOIN pg_class t ON t.oid = c.conrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
WHERE n.nspname='public' AND t.relname IN ('profiles','organizations')
ORDER BY t.relname, c.contype;

-- RLS の有効化状態を確認
SELECT
  t.relname AS table,
  t.relrowsecurity AS rls_enabled
FROM pg_class t
JOIN pg_namespace n ON n.oid = t.relnamespace
WHERE n.nspname='public' AND t.relname IN ('profiles','organizations','activity_logs')
ORDER BY t.relname;

-- 3ユーザーの存在確認（auth.users）
SELECT email, id
FROM auth.users
WHERE email IN ('member1@example.com','admin1@example.com','owner1@example.com')
ORDER BY email;
