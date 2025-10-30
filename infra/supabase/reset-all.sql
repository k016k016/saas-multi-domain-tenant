-- ============================================================
-- Complete Database Reset
-- ============================================================
-- すべてのテーブル、ポリシー、マイグレーション履歴を削除

-- 1. すべてのRLSポリシーを削除
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT schemaname, tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.tablename || '_select_policy') || ' ON ' || quote_ident(r.schemaname) || '.' || quote_ident(r.tablename);
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.tablename || '_insert_policy') || ' ON ' || quote_ident(r.schemaname) || '.' || quote_ident(r.tablename);
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.tablename || '_update_policy') || ' ON ' || quote_ident(r.schemaname) || '.' || quote_ident(r.tablename);
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.tablename || '_delete_policy') || ' ON ' || quote_ident(r.schemaname) || '.' || quote_ident(r.tablename);
    END LOOP;
END $$;

-- 2. publicスキーマのすべてのテーブルを削除（CASCADE）
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
    END LOOP;
END $$;

-- 3. Supabaseマイグレーション履歴テーブルを削除（存在する場合）
DROP TABLE IF EXISTS supabase_migrations.schema_migrations CASCADE;

-- 4. 確認メッセージ
DO $$
BEGIN
    RAISE NOTICE 'データベースリセット完了: すべてのテーブルとポリシーを削除しました';
END $$;
