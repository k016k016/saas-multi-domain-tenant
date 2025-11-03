/**
 * E2Eテスト用のデータベース操作ヘルパー関数
 *
 * テスト間の状態汚染を防ぐため、テストデータのリセット機能を提供する
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const TEST_ORG_ID = '00000000-0000-0000-0000-000000000001'; // scripts/seed-test-user.ts と同じ値（UUID形式）

/**
 * Supabase Admin Clientを作成
 *
 * SERVICE_ROLE_KEYを使用してRLSをバイパスする
 */
function getSupabaseAdmin() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * 指定ユーザーのアクティブ組織をorg1（member権限）にリセット
 *
 * @param email - ユーザーのメールアドレス
 *
 * 用途:
 * - 組織切り替えテストの後処理
 * - 権限テストの前処理でユーザーを既知の状態に戻す
 */
export async function resetUserToOrg1(email: string): Promise<void> {
  const supabase = getSupabaseAdmin();

  // メールアドレスからuser_idを取得
  const { data: userData, error: userError } = await supabase.auth.admin.listUsers();

  if (userError) {
    throw new Error(`Failed to list users: ${userError.message}`);
  }

  const user = userData.users.find(u => u.email === email);
  if (!user) {
    throw new Error(`User not found: ${email}`);
  }

  // user_org_contextをorg1にリセット
  const { error: contextError } = await supabase
    .from('user_org_context')
    .upsert({
      user_id: user.id,
      org_id: TEST_ORG_ID,
      updated_at: new Date().toISOString(),
    })
    .select();

  if (contextError) {
    throw new Error(`Failed to reset user org context: ${contextError.message}`);
  }

  console.log(`✅ [DB Helper] Reset ${email} to org1`);
}
