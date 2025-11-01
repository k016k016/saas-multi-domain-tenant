/**
 * CI環境用テストユーザーのシードスクリプト
 *
 * 責務:
 * - E2Eテスト用のユーザーを作成/更新する
 * - Supabase Auth の admin API を使用して確実にユーザーを準備
 *
 * 使い方:
 * ```bash
 * tsx scripts/seed-test-user.ts
 * ```
 *
 * 必要な環境変数:
 * - NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * - E2E_TEST_EMAIL
 * - E2E_TEST_PASSWORD
 */

import { createClient } from '@supabase/supabase-js';

async function main() {
  // 環境変数の検証
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;

  if (!url) {
    throw new Error('Missing environment variable: NEXT_PUBLIC_SUPABASE_URL');
  }
  if (!serviceRoleKey) {
    throw new Error('Missing environment variable: SUPABASE_SERVICE_ROLE_KEY');
  }
  if (!email) {
    throw new Error('Missing environment variable: E2E_TEST_EMAIL');
  }
  if (!password) {
    throw new Error('Missing environment variable: E2E_TEST_PASSWORD');
  }

  console.log('🔧 Seeding test user for E2E tests...');
  console.log(`📧 Email: ${email}`);
  console.log(`🌐 Supabase URL: ${url}`);

  // Service Role Key で Admin API を使用
  const supabase = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

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

  if (existingUser) {
    // 既存ユーザーのパスワードを更新
    console.log(`👤 User already exists (ID: ${existingUser.id}). Updating password...`);

    const { error: updateError } = await supabase.auth.admin.updateUserById(
      existingUser.id,
      {
        password,
        email_confirm: true,
      }
    );

    if (updateError) {
      throw new Error(`Failed to update user: ${updateError.message}`);
    }

    console.log('✅ Password updated successfully');
  } else {
    // 新規ユーザーを作成
    console.log('👤 Creating new user...');

    const { data: createData, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createError) {
      throw new Error(`Failed to create user: ${createError.message}`);
    }

    console.log(`✅ User created successfully (ID: ${createData.user.id})`);
  }

  console.log('🎉 Test user seeding completed');
}

main().catch((error) => {
  console.error('❌ Seeding failed:', error.message);
  process.exit(1);
});
