/**
 * E2Eテスト用ユーザーのパスワードをリセット
 *
 * Usage: npx tsx scripts/reset-password.ts member-switcher@example.com
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// .env.testを読み込む
dotenv.config({ path: resolve(__dirname, '../.env.test') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const E2E_TEST_PASSWORD = process.env.E2E_TEST_PASSWORD!;

async function resetPassword(email: string) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // ユーザーを検索
  const { data: userData, error: userError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (userError) {
    console.error('Failed to list users:', userError.message);
    process.exit(1);
  }

  const user = userData.users.find((u) => (u.email || '').toLowerCase() === email.toLowerCase());
  if (!user) {
    console.error(`User not found: ${email}`);
    process.exit(1);
  }

  console.log(`Found user: ${user.email} (ID: ${user.id})`);

  // パスワードをリセット
  const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
    password: E2E_TEST_PASSWORD,
  });

  if (updateError) {
    console.error('Failed to reset password:', updateError.message);
    process.exit(1);
  }

  console.log(`✅ Password reset successful for ${email}`);
}

const email = process.argv[2];
if (!email) {
  console.error('Usage: npx tsx scripts/reset-password.ts <email>');
  process.exit(1);
}

resetPassword(email);
