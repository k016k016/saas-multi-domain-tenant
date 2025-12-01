/**
 * E2Eテスト用のデータベース操作ヘルパー関数
 *
 * テスト間の状態汚染を防ぐため、テストデータのリセット機能を提供する
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const ORG_IDS = {
  PRIMARY: '00000000-0000-0000-0000-000000000001',
  SECONDARY: '00000000-0000-0000-0000-000000000002',
} as const;

const TEST_ORG_ID = ORG_IDS.PRIMARY; // scripts/seed-test-user.ts と同じ値（UUID形式）

/**
 * Supabase Admin Clientを作成
 *
 * SERVICE_ROLE_KEYを使用してRLSをバイパスする
 */
export function getSupabaseAdmin() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function findUserByEmail(supabase: ReturnType<typeof getSupabaseAdmin>, email: string) {
  const { data: userData, error: userError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (userError) {
    throw new Error(`Failed to list users: ${userError.message}`);
  }

  const user = userData.users.find((u) => (u.email || '').toLowerCase() === email.toLowerCase());
  if (!user) {
    throw new Error(`User not found: ${email}`);
  }

  return user;
}

async function upsertUserOrgContext(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  orgId: string,
) {
  const { error } = await supabase
    .from('user_org_context')
    .upsert({
      user_id: userId,
      org_id: orgId,
      updated_at: new Date().toISOString(),
    })
    .select();

  if (error) {
    throw new Error(`Failed to set active org context: ${error.message}`);
  }
}

export async function setUserActiveOrg(email: string, orgId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const user = await findUserByEmail(supabase, email);
  await upsertUserOrgContext(supabase, user.id, orgId);
  console.log(`✅ [DB Helper] Set ${email} active org to ${orgId}`);
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
  const user = await findUserByEmail(supabase, email);
  await upsertUserOrgContext(supabase, user.id, TEST_ORG_ID);

  // ロールをリセット（テスト間での汚染を防ぐ）
  let targetRole: string | null = null;
  if (email === 'member1@example.com' || email === 'member-switcher@example.com') {
    targetRole = 'member';
  } else if (email === 'owner1@example.com') {
    targetRole = 'owner';
  }

  if (targetRole) {
    // owner1をownerに戻す場合、先に現在のownerをadminに降格
    if (targetRole === 'owner') {
      // 現在のownerを取得（owner1以外）
      const { data: currentOwners } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('org_id', TEST_ORG_ID)
        .eq('role', 'owner')
        .neq('user_id', user.id);

      // 現在のownerをadminに降格
      for (const owner of currentOwners || []) {
        await supabase
          .from('profiles')
          .update({ role: 'admin' })
          .eq('user_id', owner.user_id)
          .eq('org_id', TEST_ORG_ID);
      }
    }

    const { error: roleError } = await supabase
      .from('profiles')
      .update({ role: targetRole })
      .eq('user_id', user.id)
      .eq('org_id', TEST_ORG_ID);

    if (roleError) {
      throw new Error(`Failed to reset user role: ${roleError.message}`);
    }
  }

  console.log(`✅ [DB Helper] Reset ${email} to org1`);
}

/**
 * テスト用ユーザーを作成（メール送信なし）
 *
 * @param email - ユーザーのメールアドレス
 * @param role - ロール（member/admin）
 * @param password - パスワード
 * @returns 作成されたユーザーのID
 *
 * 用途:
 * - 招待機能のテスト（メール送信を回避）
 * - 動的なテストユーザー作成
 */
export async function createTestUser(
  email: string,
  role: 'member' | 'admin',
  password: string
): Promise<string> {
  const supabase = getSupabaseAdmin();

  // 1. Supabase Authでユーザーを作成
  const { data: createData, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createError) {
    throw new Error(`Failed to create user: ${createError.message}`);
  }

  const userId = createData.user.id;

  // 2. profilesテーブルにレコードを作成
  const { error: profileError } = await supabase
    .from('profiles')
    .insert({
      user_id: userId,
      org_id: TEST_ORG_ID,
      role: role,
    });

  if (profileError) {
    throw new Error(`Failed to create profile: ${profileError.message}`);
  }

  // 3. user_org_contextを設定
  const { error: contextError } = await supabase
    .from('user_org_context')
    .upsert({
      user_id: userId,
      org_id: TEST_ORG_ID,
      updated_at: new Date().toISOString(),
    });

  if (contextError) {
    throw new Error(`Failed to create user context: ${contextError.message}`);
  }

  console.log(`✅ [DB Helper] Created test user ${email} with role ${role}`);
  return userId;
}

/**
 * テスト用ユーザーを削除
 *
 * @param email - ユーザーのメールアドレス
 *
 * 用途:
 * - テスト後のクリーンアップ
 */
export async function deleteTestUser(email: string): Promise<void> {
  const supabase = getSupabaseAdmin();

  // メールアドレスからuser_idを取得
  const { data: userData, error: userError } = await supabase.auth.admin.listUsers();

  if (userError) {
    throw new Error(`Failed to list users: ${userError.message}`);
  }

  const user = userData.users.find(u => u.email === email);
  if (!user) {
    // ユーザーが存在しない場合は何もしない
    return;
  }

  // profilesから削除
  await supabase
    .from('profiles')
    .delete()
    .eq('user_id', user.id);

  // user_org_contextから削除
  await supabase
    .from('user_org_context')
    .delete()
    .eq('user_id', user.id);

  // Supabase Authから削除
  await supabase.auth.admin.deleteUser(user.id);

  console.log(`✅ [DB Helper] Deleted test user ${email}`);
}

/**
 * テスト用組織を作成
 *
 * @param name - 組織名
 * @param slug - スラッグ（任意）
 * @returns 作成された組織のID
 *
 * 用途:
 * - 組織CRUD機能のテスト
 */
export async function createTestOrganization(
  name: string,
  slug?: string
): Promise<string> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('organizations')
    .insert({
      name,
      slug: slug || null,
      plan: 'free',
      is_active: true,
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to create organization: ${error.message}`);
  }

  console.log(`✅ [DB Helper] Created test organization ${name} (${data.id})`);
  return data.id;
}

/**
 * テスト用組織を削除
 *
 * @param orgId - 組織ID
 *
 * 用途:
 * - テスト後のクリーンアップ
 */
export async function deleteTestOrganization(orgId: string): Promise<void> {
  const supabase = getSupabaseAdmin();

  // 組織に紐づくメンバーを削除
  await supabase
    .from('profiles')
    .delete()
    .eq('org_id', orgId);

  // 組織を削除
  await supabase
    .from('organizations')
    .delete()
    .eq('id', orgId);

  console.log(`✅ [DB Helper] Deleted test organization ${orgId}`);
}
