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

import { createClient } from '@supabase/supabase-js';

// E2Eテスト用の組織ID（固定値）
const TEST_ORG_ID = '00000000-0000-0000-0000-000000000001';
const TEST_ORG_NAME = 'Test Organization';

// E2Eテストで使用するテストユーザー
// ロールごとに異なるメールアドレスを使用
const TEST_USERS = [
  { email: 'member1@example.com', role: 'member' },
  { email: 'owner1@example.com', role: 'owner' },
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

async function upsertUser(
  supabase: ReturnType<typeof createClient>,
  email: string,
  password: string,
  role: string
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
    });

    if (createError) {
      throw new Error(`Failed to create ${role} user: ${createError.message}`);
    }

    userId = createData.user.id;
    console.log(`✅ ${role} user created successfully (ID: ${userId})`);
  }

  // profilesテーブルにレコードを作成/更新（アプリケーションがuser_id, org_id, roleを使用するため）
  console.log(`📝 Upserting ${role} user profile in profiles table...`);

  // まず既存のプロファイルを削除
  await supabase
    .from('profiles')
    .delete()
    .eq('user_id', userId)
    .eq('org_id', TEST_ORG_ID);

  // 新しいプロファイルを挿入
  const { error: profileError } = await supabase
    .from('profiles')
    .insert({
      user_id: userId,
      org_id: TEST_ORG_ID,
      role: role,
      metadata: {},
    })
    .select();

  if (profileError) {
    throw new Error(`Failed to insert ${role} user profile: ${profileError.message}`);
  }

  console.log(`✅ ${role} user profile upserted successfully`);
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
  console.log(`👥 Creating ${TEST_USERS.length} test users...`);

  // Service Role Key で Admin API を使用
  const supabase = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // テスト用組織を作成/更新
  await upsertOrganization(supabase);

  // 各テストユーザーを作成/更新
  for (const user of TEST_USERS) {
    await upsertUser(supabase, user.email, password, user.role);
  }

  console.log('🎉 All test organization and users seeding completed');
}

main().catch((error) => {
  console.error('❌ Seeding failed:', error.message);
  process.exit(1);
});
