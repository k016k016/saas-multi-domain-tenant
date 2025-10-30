-- ============================================================
-- E2E Test Setup: Test Data Seed
-- ============================================================
-- 前提:
--  - Authに下記メールのユーザーが存在すること（email/password 可、email_confirm=true）
--    - member1@example.com / testtest
--    - admin1@example.com / testtest
--    - owner1@example.com / testtest
--  - RLSは有効のままでOK（Service Roleで実行される想定）
-- 目的:
--  - "E2E Org" を作成 or 取得
--  - profiles に org_id と role を紐付け（ownerは1名）

DO $$
DECLARE
  v_org_id   UUID;
  v_member   UUID;
  v_admin    UUID;
  v_owner    UUID;
BEGIN
  -- Orgを作成 or 取得
  SELECT id INTO v_org_id
  FROM organizations
  WHERE name = 'E2E Org';

  IF v_org_id IS NULL THEN
    v_org_id := gen_random_uuid();
    INSERT INTO organizations (id, name, plan, is_active, created_at)
    VALUES (v_org_id, 'E2E Org', 'pro', true, now());
  END IF;

  -- AuthユーザーID取得（Service Roleで実行すること）
  SELECT id INTO v_member FROM auth.users WHERE email = 'member1@example.com';
  SELECT id INTO v_admin  FROM auth.users WHERE email = 'admin1@example.com';
  SELECT id INTO v_owner  FROM auth.users WHERE email = 'owner1@example.com';

  IF v_member IS NULL OR v_admin IS NULL OR v_owner IS NULL THEN
    RAISE EXCEPTION 'Auth user not found. Seed auth users first.';
  END IF;

  -- profiles 紐付け（注意: id=auth.user.id がPK）
  -- 既存があれば上書き（org切替テストのために明示的に統一）
  INSERT INTO profiles (id, org_id, role, metadata, updated_at)
  VALUES (v_member, v_org_id, 'member', '{}'::jsonb, now())
  ON CONFLICT (id) DO UPDATE
    SET org_id = excluded.org_id, role = excluded.role, updated_at = now();

  INSERT INTO profiles (id, org_id, role, metadata, updated_at)
  VALUES (v_admin, v_org_id, 'admin', '{}'::jsonb, now())
  ON CONFLICT (id) DO UPDATE
    SET org_id = excluded.org_id, role = excluded.role, updated_at = now();

  INSERT INTO profiles (id, org_id, role, metadata, updated_at)
  VALUES (v_owner, v_org_id, 'owner', '{}'::jsonb, now())
  ON CONFLICT (id) DO UPDATE
    SET org_id = excluded.org_id, role = excluded.role, updated_at = now();

  -- ownerが1名であることの軽い検証（同org）
  IF (SELECT count(*) FROM profiles WHERE org_id = v_org_id AND role = 'owner') <> 1 THEN
    RAISE EXCEPTION 'owner must be exactly 1 per org.';
  END IF;
END$$;

-- 確認用（必要なら実行）
SELECT o.name AS org, u.email, p.role
FROM profiles p
JOIN organizations o ON o.id = p.org_id
JOIN auth.users u ON u.id = p.id
WHERE o.name='E2E Org'
ORDER BY role;
