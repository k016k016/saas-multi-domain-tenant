/**
 * E2E Test Setup: Create Auth Users
 *
 * Supabase Auth に E2E テスト用のユーザーを作成します。
 *
 * 前提:
 *  - .env.test に SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY が設定されていること
 *  - Supabase Dashboard で Email/Password 認証が有効化されていること
 *
 * 使い方:
 *   pnpm tsx infra/supabase/seeds/create-auth-users.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// .env.test を読み込み
dotenv.config({ path: path.join(__dirname, '../../../.env.test') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD || 'testtest';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Error: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set in .env.test');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const TEST_USERS = [
  { email: 'member1@example.com', role: 'member' },
  { email: 'admin1@example.com', role: 'admin' },
  { email: 'owner1@example.com', role: 'owner' },
];

async function createAuthUsers() {
  console.log('==================================');
  console.log('E2E Test Setup: Creating Auth Users');
  console.log('==================================\n');

  for (const user of TEST_USERS) {
    console.log(`Creating user: ${user.email} (${user.role})...`);

    try {
      // ユーザーが既に存在するか確認
      const { data: existingUsers } = await supabase.auth.admin.listUsers();
      const exists = existingUsers?.users.some((u) => u.email === user.email);

      if (exists) {
        console.log(`  ⚠️  User already exists: ${user.email}`);
        continue;
      }

      // ユーザーを作成
      const { data, error } = await supabase.auth.admin.createUser({
        email: user.email,
        password: TEST_PASSWORD,
        email_confirm: true, // メール確認をスキップ
      });

      if (error) {
        console.error(`  ❌ Error creating ${user.email}:`, error.message);
      } else {
        console.log(`  ✅ Created: ${user.email} (ID: ${data.user?.id})`);
      }
    } catch (err) {
      console.error(`  ❌ Unexpected error for ${user.email}:`, err);
    }
  }

  console.log('\n==================================');
  console.log('✅ Auth users creation completed!');
  console.log('==================================');
  console.log('\nNext steps:');
  console.log('  1. Run: ./infra/supabase/seeds/run-seeds.sh');
  console.log('  2. Run: pnpm test:e2e');
}

createAuthUsers().catch(console.error);
