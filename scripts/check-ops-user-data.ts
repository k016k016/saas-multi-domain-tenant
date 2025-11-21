/**
 * ops1ユーザーのSupabaseデータ検証スクリプト
 *
 * 確認内容:
 * - auth.usersテーブル: ops1@example.comの認証情報
 * - profilesテーブル: user_idのロール・組織情報
 * - user_org_contextテーブル: アクティブ組織
 * - organizationsテーブル: OPS組織の存在
 *
 * 使い方:
 * ```bash
 * tsx scripts/check-ops-user-data.ts
 * ```
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// .env.testから環境変数を読み込む
config({ path: '.env.test' });

const OPS_USER_EMAIL = 'ops1@example.com';
const OPS_USER_ID = '80568bfd-345d-4a32-901d-e27dfdca0688';
const OPS_ORG_ID = '00000000-0000-0000-0000-000000000099';
const TEST_ORG_ID = '00000000-0000-0000-0000-000000000001';

async function checkOpsUserData() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error('Missing environment variables: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  console.log('🔍 Checking ops1@example.com user data...\n');

  const supabase = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // 1. auth.users テーブルの確認
  console.log('📋 1. Checking auth.users table...');
  const { data: listData, error: listError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (listError) {
    throw new Error(`Failed to list users: ${listError.message}`);
  }

  const opsUser = listData.users.find((u) => u.email === OPS_USER_EMAIL);

  if (!opsUser) {
    console.error('❌ ops1@example.com user NOT FOUND in auth.users');
    return;
  }

  console.log('✅ User found in auth.users:');
  console.log(`   - ID: ${opsUser.id}`);
  console.log(`   - Email: ${opsUser.email}`);
  console.log(`   - Email confirmed: ${opsUser.email_confirmed_at ? 'Yes' : 'No'}`);
  console.log(`   - Last sign in: ${opsUser.last_sign_in_at || 'Never'}`);
  console.log(`   - Created at: ${opsUser.created_at}`);
  console.log();

  // 2. profiles テーブルの確認
  console.log('📋 2. Checking profiles table...');
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', opsUser.id);

  if (profilesError) {
    throw new Error(`Failed to fetch profiles: ${profilesError.message}`);
  }

  if (!profiles || profiles.length === 0) {
    console.error('❌ No profiles found for ops1@example.com');
    return;
  }

  console.log(`✅ Found ${profiles.length} profile(s):`);
  for (const profile of profiles) {
    console.log(`   - org_id: ${profile.org_id}, role: ${profile.role}`);
  }
  console.log();

  // 3. user_org_context テーブルの確認
  console.log('📋 3. Checking user_org_context table...');
  const { data: context, error: contextError } = await supabase
    .from('user_org_context')
    .select('*')
    .eq('user_id', opsUser.id)
    .single();

  if (contextError) {
    console.error(`❌ Failed to fetch user_org_context: ${contextError.message}`);
  } else {
    console.log('✅ Active organization context:');
    console.log(`   - org_id: ${context.org_id}`);
    console.log(`   - updated_at: ${context.updated_at}`);
  }
  console.log();

  // 4. organizations テーブルの確認
  console.log('📋 4. Checking organizations table...');
  const { data: opsOrg, error: opsOrgError } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', OPS_ORG_ID)
    .single();

  if (opsOrgError) {
    console.error(`❌ OPS organization (${OPS_ORG_ID}) NOT FOUND: ${opsOrgError.message}`);
  } else {
    console.log('✅ OPS organization found:');
    console.log(`   - ID: ${opsOrg.id}`);
    console.log(`   - Name: ${opsOrg.name}`);
    console.log(`   - Slug: ${opsOrg.slug}`);
    console.log(`   - Active: ${opsOrg.is_active}`);
  }
  console.log();

  const { data: testOrg, error: testOrgError } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', TEST_ORG_ID)
    .single();

  if (testOrgError) {
    console.error(`❌ Test organization (${TEST_ORG_ID}) NOT FOUND: ${testOrgError.message}`);
  } else {
    console.log('✅ Test organization found:');
    console.log(`   - ID: ${testOrg.id}`);
    console.log(`   - Name: ${testOrg.name}`);
    console.log(`   - Slug: ${testOrg.slug}`);
    console.log(`   - Active: ${testOrg.is_active}`);
  }
  console.log();

  // データ整合性チェック
  console.log('📊 Data consistency check:');
  let hasIssues = false;

  // OPS組織のownerロールがあるか
  const opsOwnerProfile = profiles.find(
    (p) => p.org_id === OPS_ORG_ID && p.role === 'owner'
  );
  if (!opsOwnerProfile) {
    console.error(`❌ ops1 does NOT have owner role in OPS organization (${OPS_ORG_ID})`);
    hasIssues = true;
  } else {
    console.log(`✅ ops1 has owner role in OPS organization`);
  }

  // Test組織のadminロールがあるか
  const testAdminProfile = profiles.find(
    (p) => p.org_id === TEST_ORG_ID && p.role === 'admin'
  );
  if (!testAdminProfile) {
    console.error(`❌ ops1 does NOT have admin role in Test organization (${TEST_ORG_ID})`);
    hasIssues = true;
  } else {
    console.log(`✅ ops1 has admin role in Test organization`);
  }

  // アクティブ組織が設定されているか
  if (!context) {
    console.error('❌ Active organization context is NOT set');
    hasIssues = true;
  } else {
    console.log(`✅ Active organization is set to: ${context.org_id}`);
  }

  console.log();
  if (hasIssues) {
    console.log('⚠️  Data inconsistencies detected!');
  } else {
    console.log('🎉 All data looks good!');
  }
}

checkOpsUserData().catch((error) => {
  console.error('❌ Check failed:', error.message);
  process.exit(1);
});
