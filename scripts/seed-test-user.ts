/**
 * CI環境用テストユーザーのシードスクリプト
 *
 * 責務:
 * - E2Eテスト用の組織(organizations)を作成/更新する
 * - E2Eテスト用のユーザーを作成/更新する
 * - Supabase Auth の admin API を使用して確実にユーザーを準備
 * - profilesテーブルにuser_id, org_id, roleを挿入してアプリケーションで使えるようにする
 * - 複数のロール（member, owner）を持つテストユーザーを作成
 *
 * 使い方:
 * ```bash
 * tsx scripts/seed-test-user.ts
 * ```
 *
 * 必要な環境変数:
 * - NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * - E2E_TEST_PASSWORD
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// .env.testファイルから環境変数を読み込む
config({ path: '.env.test' });

// E2Eテスト用の組織ID（固定値）
const TEST_ORG_ID = '00000000-0000-0000-0000-000000000001';
const TEST_ORG_NAME = 'Test Organization';

// 組織切替テスト用の2つ目の組織
const TEST_ORG_ID_2 = '00000000-0000-0000-0000-000000000002';
const TEST_ORG_NAME_2 = 'Test Organization Beta';

// E2Eテストで使用するテストユーザー
// ロールごとに異なるメールアドレスを使用
const TEST_USERS = [
  { email: 'member1@example.com', role: 'member', name: '田中 太郎' },
  { email: 'admin1@example.com', role: 'admin', name: '鈴木 花子' },
  { email: 'owner1@example.com', role: 'owner', name: '山田 一郎' },
  { email: 'owner2@example.com', role: 'owner', name: '佐藤 次郎' },
] as const;

async function upsertOrganization(supabase: ReturnType<typeof createClient>) {
  console.log(`🏢 Upserting test organization (${TEST_ORG_NAME})...`);

  const { error } = await supabase
    .from('organizations')
    .upsert({
      id: TEST_ORG_ID,
      name: TEST_ORG_NAME,
      plan: 'business',
      is_active: true,
    })
    .select();

  if (error) {
    throw new Error(`Failed to upsert organization: ${error.message}`);
  }

  console.log(`✅ Test organization upserted successfully (ID: ${TEST_ORG_ID})`);
}

async function upsertOrganization2(supabase: ReturnType<typeof createClient>) {
  console.log(`🏢 Upserting second test organization (${TEST_ORG_NAME_2})...`);

  const { error } = await supabase
    .from('organizations')
    .upsert({
      id: TEST_ORG_ID_2,
      name: TEST_ORG_NAME_2,
      plan: 'business',
      is_active: true,
    })
    .select();

  if (error) {
    throw new Error(`Failed to upsert second organization: ${error.message}`);
  }

  console.log(`✅ Second test organization upserted successfully (ID: ${TEST_ORG_ID_2})`);
}

async function upsertUser(
  supabase: ReturnType<typeof createClient>,
  email: string,
  password: string,
  role: string,
  name: string
) {
  // 既存ユーザーを検索
  const { data: listData, error: listError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (listError) {
    throw new Error(`Failed to list users: ${listError.message}`);
  }

  const existingUser = listData.users.find(
    (u) => (u.email || '').toLowerCase() === email.toLowerCase()
  );

  let userId: string;

  if (existingUser) {
    // 既存ユーザーのパスワードを更新
    console.log(
      `👤 ${role} user already exists (${email}, ID: ${existingUser.id}). Updating password...`
    );

    const { error: updateError } = await supabase.auth.admin.updateUserById(
      existingUser.id,
      {
        password,
        email_confirm: true,
        user_metadata: { name },
      }
    );

    if (updateError) {
      throw new Error(`Failed to update ${role} user: ${updateError.message}`);
    }

    userId = existingUser.id;
    console.log(`✅ ${role} user password updated successfully`);
  } else {
    // 新規ユーザーを作成
    console.log(`👤 Creating ${role} user (${email})...`);

    const { data: createData, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    });

    if (createError) {
      throw new Error(`Failed to create ${role} user: ${createError.message}`);
    }

    userId = createData.user.id;
    console.log(`✅ ${role} user created successfully (ID: ${userId})`);
  }

  // profilesテーブルにレコードを作成/更新（アプリケーションがuser_id, org_id, roleを使用するため）
  console.log(`📝 Upserting ${role} user profile in profiles table...`);

  // まず既存のプロファイルを削除（全組織）
  await supabase
    .from('profiles')
    .delete()
    .eq('user_id', userId);

  // ユーザーごとに所属組織とロールを決定
  let orgRoles: Array<{ orgId: string; role: string }>;

  if (email === 'member1@example.com') {
    // member1: org1ではmember、org2ではadmin（ロール変化パターン）
    orgRoles = [
      { orgId: TEST_ORG_ID, role: 'member' },
      { orgId: TEST_ORG_ID_2, role: 'admin' },
    ];
  } else if (email === 'admin1@example.com') {
    // admin1: org1ではadmin、org2ではmember（ロール変化パターン）
    orgRoles = [
      { orgId: TEST_ORG_ID, role: 'admin' },
      { orgId: TEST_ORG_ID_2, role: 'member' },
    ];
  } else if (email === 'owner2@example.com') {
    // owner2: org2のみ（仕様遵守: 各組織に必ず1人のowner）
    orgRoles = [{ orgId: TEST_ORG_ID_2, role: 'owner' }];
  } else {
    // owner1など: org1のみ
    orgRoles = [{ orgId: TEST_ORG_ID, role }];
  }

  for (const { orgId, role: orgRole } of orgRoles) {
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        user_id: userId,
        org_id: orgId,
        role: orgRole,
        metadata: {},
      })
      .select();

    if (profileError) {
      throw new Error(`Failed to insert ${orgRole} user profile for org ${orgId}: ${profileError.message}`);
    }

    console.log(`✅ ${orgRole} user profile upserted successfully for org ${orgId}`);
  }

  // user_org_context テーブルにアクティブ組織を設定
  console.log(`🔄 Upserting ${role} user active organization context...`);

  const { error: contextError } = await supabase
    .from('user_org_context')
    .upsert({
      user_id: userId,
      org_id: TEST_ORG_ID,
      updated_at: new Date().toISOString(),
    })
    .select();

  if (contextError) {
    throw new Error(`Failed to upsert ${role} user context: ${contextError.message}`);
  }

  console.log(`✅ ${role} user context upserted successfully`);
}

async function cleanupTestUsers(supabase: ReturnType<typeof createClient>) {
  console.log('🧹 Cleaning up test users (test-*@example.com)...');

  // 全ユーザーを取得
  const { data: listData, error: listError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (listError) {
    throw new Error(`Failed to list users: ${listError.message}`);
  }

  // test-*@example.com パターンにマッチするユーザーを抽出
  const testUsers = listData.users.filter(
    (u) => u.email && /^test-\d+@example\.com$/.test(u.email)
  );

  if (testUsers.length === 0) {
    console.log('✅ No test users to cleanup');
    return;
  }

  console.log(`🗑️ Found ${testUsers.length} test users to delete`);

  for (const user of testUsers) {
    // profilesテーブルから削除
    await supabase
      .from('profiles')
      .delete()
      .eq('user_id', user.id);

    // user_org_contextテーブルから削除
    await supabase
      .from('user_org_context')
      .delete()
      .eq('user_id', user.id);

    // auth.usersから削除
    const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
    if (deleteError) {
      console.warn(`⚠️ Failed to delete user ${user.email}: ${deleteError.message}`);
    } else {
      console.log(`🗑️ Deleted test user: ${user.email}`);
    }
  }

  console.log(`✅ Cleanup completed: ${testUsers.length} test users deleted`);
}

async function main() {
  // 環境変数の検証
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const password = process.env.E2E_TEST_PASSWORD;

  if (!url) {
    throw new Error('Missing environment variable: NEXT_PUBLIC_SUPABASE_URL');
  }
  if (!serviceRoleKey) {
    throw new Error('Missing environment variable: SUPABASE_SERVICE_ROLE_KEY');
  }
  if (!password) {
    throw new Error('Missing environment variable: E2E_TEST_PASSWORD');
  }

  console.log('🔧 Seeding test organization and users for E2E tests...');
  console.log(`🌐 Supabase URL: ${url}`);
  console.log(`🏢 Organization: ${TEST_ORG_NAME} (ID: ${TEST_ORG_ID})`);
  console.log(`👥 Creating ${TEST_USERS.length} test users (member, admin, owner x2)...`);

  // Service Role Key で Admin API を使用
  const supabase = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // テストで作成されたユーザーをクリーンアップ
  await cleanupTestUsers(supabase);

  // テスト用組織を作成/更新
  await upsertOrganization(supabase);
  await upsertOrganization2(supabase);

  // 各テストユーザーを作成/更新
  for (const user of TEST_USERS) {
    await upsertUser(supabase, user.email, password, user.role, user.name);
  }

  console.log('🎉 All test organizations and users seeding completed');
}

main().catch((error) => {
  console.error('❌ Seeding failed:', error.message);
  process.exit(1);
});
