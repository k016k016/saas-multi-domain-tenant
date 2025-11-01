/**
 * E2Eテスト用ユーザーのパスワードをリセット
 *
 * Usage: tsx scripts/reset-test-passwords.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.test' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const testPassword = process.env.E2E_TEST_PASSWORD!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const TEST_USERS = [
  'member1@example.com',
  'admin1@example.com',
  'owner1@example.com',
];

async function resetPasswords() {
  console.log('🔐 E2Eテストユーザーのパスワードをリセット中...\n');

  for (const email of TEST_USERS) {
    try {
      // ユーザーIDを取得
      const { data: users, error: listError } = await supabase.auth.admin.listUsers();
      if (listError) throw listError;

      const user = users.users.find((u) => u.email === email);
      if (!user) {
        console.log(`⚠️  ${email}: ユーザーが見つかりません`);
        continue;
      }

      // パスワードを更新
      const { error: updateError } = await supabase.auth.admin.updateUserById(
        user.id,
        { password: testPassword }
      );

      if (updateError) {
        console.log(`❌ ${email}: パスワード更新失敗 - ${updateError.message}`);
      } else {
        console.log(`✅ ${email}: パスワード更新成功`);
      }
    } catch (error) {
      console.error(`❌ ${email}: エラー -`, error);
    }
  }

  console.log('\n✨ 完了');
}

resetPasswords().catch(console.error);
