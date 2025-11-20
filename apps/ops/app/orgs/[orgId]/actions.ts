'use server';

/**
 * メンバー管理のServer Actions
 *
 * 責務:
 * - メンバーの招待
 * - メンバー情報の更新
 * - メンバーの削除
 * - パスワード変更
 * - 活動ログの記録
 */

import { isOpsUser } from '@repo/config';
import { getSupabaseAdmin } from '@repo/db';

interface ActionResult {
  success: boolean;
  error?: string;
}

/**
 * メンバーを招待（新規作成）
 */
export async function inviteMember(
  orgId: string,
  name: string,
  email: string,
  password: string,
  role: 'member' | 'admin' | 'owner'
): Promise<ActionResult> {
  // ops権限チェック
  const hasOpsPermission = await isOpsUser();
  if (!hasOpsPermission) {
    return { success: false, error: 'ops権限が必要です' };
  }

  // バリデーション
  if (!name || !email || !password) {
    return { success: false, error: '必須項目を入力してください' };
  }

  if (password.length < 6) {
    return { success: false, error: 'パスワードは6文字以上で入力してください' };
  }

  const supabaseAdmin = getSupabaseAdmin();

  // 組織が存在するか確認
  const { data: org } = await supabaseAdmin
    .from('organizations')
    .select('id')
    .eq('id', orgId)
    .single();

  if (!org) {
    return { success: false, error: '組織が見つかりません' };
  }

  // Supabase Authでユーザーを作成
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      name,
    },
  });

  if (authError) {
    console.error('[inviteMember] Failed to create user:', authError);
    return { success: false, error: 'ユーザー作成に失敗しました' };
  }

  // profilesテーブルにレコードを作成
  const { error: profileError } = await supabaseAdmin.from('profiles').insert({
    user_id: authData.user.id,
    org_id: orgId,
    role,
  });

  if (profileError) {
    console.error('[inviteMember] Failed to create profile:', profileError);
    // ユーザーを削除してロールバック
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
    return { success: false, error: 'プロフィール作成に失敗しました' };
  }

  // user_org_contextを設定
  const { error: contextError } = await supabaseAdmin.from('user_org_context').upsert({
    user_id: authData.user.id,
    org_id: orgId,
    updated_at: new Date().toISOString(),
  });

  if (contextError) {
    console.error('[inviteMember] Failed to create context:', contextError);
  }

  // 活動ログを記録
  await supabaseAdmin.from('activity_logs').insert({
    org_id: orgId,
    user_id: null, // ops操作
    action: 'member.invited',
    details: {
      invited_user_id: authData.user.id,
      invited_email: email,
      role,
    },
  });

  return { success: true };
}

/**
 * メンバー情報を更新
 */
export async function updateMember(
  orgId: string,
  userId: string,
  name: string,
  role: 'member' | 'admin' | 'owner',
  password?: string
): Promise<ActionResult> {
  // ops権限チェック
  const hasOpsPermission = await isOpsUser();
  if (!hasOpsPermission) {
    return { success: false, error: 'ops権限が必要です' };
  }

  // バリデーション
  if (!name) {
    return { success: false, error: '氏名は必須です' };
  }

  const supabaseAdmin = getSupabaseAdmin();

  // ownerかどうか確認
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('user_id', userId)
    .eq('org_id', orgId)
    .single();

  if (!profile) {
    return { success: false, error: 'ユーザーが見つかりません' };
  }

  if (profile.role === 'owner' && role !== 'owner') {
    return { success: false, error: 'ownerのロールは変更できません' };
  }

  // ユーザー情報を更新
  const updateData: { user_metadata: { name: string }; password?: string } = {
    user_metadata: { name },
  };

  if (password && password.length > 0) {
    if (password.length < 6) {
      return { success: false, error: 'パスワードは6文字以上で入力してください' };
    }
    updateData.password = password;
  }

  const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
    userId,
    updateData
  );

  if (authError) {
    console.error('[updateMember] Failed to update user:', authError);
    return { success: false, error: 'ユーザー情報の更新に失敗しました' };
  }

  // ロールを更新
  const { error: roleError } = await supabaseAdmin
    .from('profiles')
    .update({ role })
    .eq('user_id', userId)
    .eq('org_id', orgId);

  if (roleError) {
    console.error('[updateMember] Failed to update role:', roleError);
    return { success: false, error: 'ロールの更新に失敗しました' };
  }

  // 活動ログを記録
  await supabaseAdmin.from('activity_logs').insert({
    org_id: orgId,
    user_id: null, // ops操作
    action: 'member.updated',
    details: {
      target_user_id: userId,
      new_role: role,
      password_changed: !!password,
    },
  });

  return { success: true };
}

/**
 * メンバーを削除
 */
export async function deleteMember(orgId: string, userId: string): Promise<ActionResult> {
  // ops権限チェック
  const hasOpsPermission = await isOpsUser();
  if (!hasOpsPermission) {
    return { success: false, error: 'ops権限が必要です' };
  }

  const supabaseAdmin = getSupabaseAdmin();

  // ownerは削除不可
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('user_id', userId)
    .eq('org_id', orgId)
    .single();

  if (!profile) {
    return { success: false, error: 'ユーザーが見つかりません' };
  }

  if (profile.role === 'owner') {
    return { success: false, error: 'ownerは削除できません' };
  }

  // 活動ログを記録（削除前に記録）
  await supabaseAdmin.from('activity_logs').insert({
    org_id: orgId,
    user_id: null, // ops操作
    action: 'member.deleted',
    details: {
      deleted_user_id: userId,
    },
  });

  // profilesから削除
  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .delete()
    .eq('user_id', userId)
    .eq('org_id', orgId);

  if (profileError) {
    console.error('[deleteMember] Failed to delete profile:', profileError);
    return { success: false, error: 'メンバーの削除に失敗しました' };
  }

  // user_org_contextから削除
  await supabaseAdmin
    .from('user_org_context')
    .delete()
    .eq('user_id', userId);

  // Supabase Authから削除
  const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);

  if (authError) {
    console.error('[deleteMember] Failed to delete user from auth:', authError);
  }

  return { success: true };
}
