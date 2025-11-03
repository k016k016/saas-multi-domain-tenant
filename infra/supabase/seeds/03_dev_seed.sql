-- ============================================================
-- E2E Test Setup: Test Data Seed
-- ============================================================
-- 前提:
--  - Authに下記メールのユーザーが存在すること（email/password 可、email_confirm=true）
--    - member1@example.com
--    - admin1@example.com
--    - owner1@example.com
--  - パスワードは E2E_TEST_PASSWORD 環境変数で管理（scripts/seed-test-user.ts で設定）
--  - RLSは有効のままでOK（Service Roleで実行される想定）
-- 目的:
--  - 固定組織ID "00000000-0000-0000-0000-000000000001" で "Test Organization" を作成
--  - 組織切替テスト用の2つ目の組織 "00000000-0000-0000-0000-000000000002" で "Test Organization Beta" を作成
--  - profiles に org_id と role を紐付け（ownerは1名）
--  - member1は両方の組織に所属（組織切替テストのため）

DO $$
DECLARE
  v_org_id   UUID := '00000000-0000-0000-0000-000000000001';
  v_org_id_2 UUID := '00000000-0000-0000-0000-000000000002';
  v_member   UUID;
  v_admin    UUID;
  v_owner    UUID;
BEGIN
  -- 固定組織IDで作成 or 取得（seed-test-user.ts と統一）
  INSERT INTO organizations (id, name, plan, is_active, created_at)
  VALUES (v_org_id, 'Test Organization', 'pro', true, now())
  ON CONFLICT (id) DO UPDATE
    SET name = excluded.name, updated_at = now();

  -- 2つ目の組織を作成（組織切替テスト用）
  INSERT INTO organizations (id, name, plan, is_active, created_at)
  VALUES (v_org_id_2, 'Test Organization Beta', 'business', true, now())
  ON CONFLICT (id) DO UPDATE
    SET name = excluded.name, updated_at = now();

  -- AuthユーザーID取得（Service Roleで実行すること）
  SELECT id INTO v_member FROM auth.users WHERE email = 'member1@example.com';
  SELECT id INTO v_admin  FROM auth.users WHERE email = 'admin1@example.com';
  SELECT id INTO v_owner  FROM auth.users WHERE email = 'owner1@example.com';

  IF v_member IS NULL OR v_admin IS NULL OR v_owner IS NULL THEN
    RAISE EXCEPTION 'Auth user not found. Seed auth users first.';
  END IF;

  -- profiles 紐付け（注意: user_id → auth.users.id）
  -- 既存があれば上書き（org切替テストのために明示的に統一）
  INSERT INTO profiles (user_id, org_id, role, metadata, updated_at)
  VALUES (v_member, v_org_id, 'member', '{}'::jsonb, now())
  ON CONFLICT (user_id, org_id) DO UPDATE
    SET role = excluded.role, updated_at = now();

  INSERT INTO profiles (user_id, org_id, role, metadata, updated_at)
  VALUES (v_admin, v_org_id, 'admin', '{}'::jsonb, now())
  ON CONFLICT (user_id, org_id) DO UPDATE
    SET role = excluded.role, updated_at = now();

  INSERT INTO profiles (user_id, org_id, role, metadata, updated_at)
  VALUES (v_owner, v_org_id, 'owner', '{}'::jsonb, now())
  ON CONFLICT (user_id, org_id) DO UPDATE
    SET role = excluded.role, updated_at = now();

  -- member1を2つ目の組織にも追加（組織切替テストのため）
  INSERT INTO profiles (user_id, org_id, role, metadata, updated_at)
  VALUES (v_member, v_org_id_2, 'member', '{}'::jsonb, now())
  ON CONFLICT (user_id, org_id) DO UPDATE
    SET role = excluded.role, updated_at = now();

  -- ownerが1名であることの軽い検証（各組織ごと）
  IF (SELECT count(*) FROM profiles WHERE org_id = v_org_id AND role = 'owner') <> 1 THEN
    RAISE EXCEPTION 'owner must be exactly 1 per org (org_id=%)', v_org_id;
  END IF;

  -- 2つ目の組織にはownerがいないため、この検証はスキップ
  -- （必要に応じて2つ目の組織にもowner2を追加可能）
END$$;

-- 確認用（必要なら実行）
SELECT o.name AS org, u.email, p.role
FROM profiles p
JOIN organizations o ON o.id = p.org_id
JOIN auth.users u ON u.id = p.user_id
WHERE o.name LIKE 'Test Organization%'
ORDER BY o.name, p.role;
