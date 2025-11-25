'use server';

/**
 * ユーザー管理のServer Actions
 *
 * 重要な設計方針:
 * - redirect()は使用しない。必ず{ success, nextUrl }を返す
 * - クライアント側でrouter.push(nextUrl)を使って遷移する
 * - adminとownerの両方がアクセス可能
 * - ownerの削除・ロール変更は禁止
 * - すべての操作はactivity_logsに記録する（将来実装）
 */

import { createServerClient, getSupabaseAdmin, logActivity } from '@repo/db';
import { getCurrentOrg, getCurrentRole, hasRole } from '@repo/config';
import type { ActionResult, Role } from '@repo/config';

/**
 * ユーザーを追加する
 *
 * @param email - 追加するユーザーのメールアドレス
 * @param password - 初期パスワード
 * @param name - 氏名
 * @param role - 初期ロール（member/admin）
 * @returns ActionResult
 */
export async function inviteUser(
  email: string,
  password: string,
  name: string,
  role: Role
): Promise<ActionResult> {
  // 1. 入力バリデーション
  if (!email || typeof email !== 'string') {
    return {
      success: false,
      error: 'メールアドレスが不正です',
    };
  }

  // 簡易的なメールアドレス検証
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return {
      success: false,
      error: 'メールアドレスの形式が正しくありません',
    };
  }

  if (!password || password.length < 6) {
    return {
      success: false,
      error: 'パスワードは6文字以上で指定してください',
    };
  }

  if (!name || name.trim().length === 0) {
    return {
      success: false,
      error: '氏名を入力してください',
    };
  }

  if (!role || !['member', 'admin'].includes(role)) {
    return {
      success: false,
      error: 'ロールはmemberまたはadminを指定してください',
    };
  }

  // 2. 権限チェック
  const roleContext = await getCurrentRole();
  const currentUserRole = roleContext?.role;
  if (!currentUserRole || !hasRole(currentUserRole, 'admin')) {
    return {
      success: false,
      error: 'この操作を行う権限がありません',
    };
  }

  // 3. 現在の組織を取得
  const org = await getCurrentOrg();
  if (!org) {
    return {
      success: false,
      error: '組織情報が見つかりません',
    };
  }

  // 4. 現在のユーザーIDを取得
  const supabase = await createServerClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  const currentUserId = user?.id;
  if (!currentUserId) {
    return {
      success: false,
      error: '認証セッションが見つかりません',
    };
  }

  // 5. ユーザー作成処理（Service Role Key使用）
  const supabaseAdmin = getSupabaseAdmin();

  // 5-1. Supabase Authでユーザーを作成
  const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      name: name.trim(),
    },
  });

  if (createError) {
    console.error('[inviteUser] Create user error:', createError);
    // メールアドレス重複の場合
    if (createError.message.includes('already been registered')) {
      return { success: false, error: 'このメールアドレスは既に登録されています' };
    }
    return { success: false, error: 'ユーザーの作成に失敗しました' };
  }

  const userId = createData.user.id;

  // 5-2. profilesテーブルにユーザーレコードを作成
  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .insert({
      user_id: userId,
      org_id: org.orgId,
      role: role,
    });

  if (profileError) {
    console.error('[inviteUser] Profile creation error:', profileError);
    // Authユーザーは作成されたがprofile作成に失敗した場合、Authユーザーを削除
    await supabaseAdmin.auth.admin.deleteUser(userId);
    return { success: false, error: 'ユーザーレコードの作成に失敗しました' };
  }

  // 5-3. user_org_contextを設定
  const { error: contextError } = await supabaseAdmin
    .from('user_org_context')
    .upsert({
      user_id: userId,
      org_id: org.orgId,
      updated_at: new Date().toISOString(),
    });

  if (contextError) {
    console.error('[inviteUser] Context creation error:', contextError);
    // 致命的ではないのでワーニングのみ
  }

  // 6. 監査ログ記録
  const logResult = await logActivity(supabaseAdmin, {
    orgId: org.orgId,
    userId: currentUserId,
    action: 'member.invited',
    payload: {
      invited_email: email,
      invited_name: name.trim(),
      invited_role: role,
      timestamp: new Date().toISOString(),
    },
  });

  if (logResult.error) {
    console.warn('[inviteUser] Activity log failed:', logResult.error);
  }

  // 7. 成功を返す
  return {
    success: true,
    nextUrl: '/members',
  };
}

/**
 * ユーザーのロールを変更する
 *
 * @param targetUserId - 対象ユーザーのID
 * @param newRole - 新しいロール（member/admin）
 * @returns ActionResult
 */
export async function changeUserRole(
  targetUserId: string,
  newRole: Role
): Promise<ActionResult> {
  // 1. 入力バリデーション
  if (!targetUserId || typeof targetUserId !== 'string') {
    return {
      success: false,
      error: 'ユーザーIDが不正です',
    };
  }

  if (!newRole || !['member', 'admin'].includes(newRole)) {
    return {
      success: false,
      error: 'ロールはmemberまたはadminを指定してください',
    };
  }

  // 2. 権限チェック
  const roleContext = await getCurrentRole();
  const currentUserRole = roleContext?.role;
  if (!currentUserRole || !hasRole(currentUserRole, 'admin')) {
    return {
      success: false,
      error: 'この操作を行う権限がありません',
    };
  }

  // 3. 現在の組織を取得
  const org = await getCurrentOrg();
  if (!org) {
    return {
      success: false,
      error: '組織情報が見つかりません',
    };
  }

  // 4. 現在のユーザーIDを取得
  const supabase = await createServerClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  const currentUserId = user?.id;
  if (!currentUserId) {
    return {
      success: false,
      error: '認証セッションが見つかりません',
    };
  }

  // 5. Service Role Keyで操作
  const supabaseAdmin = getSupabaseAdmin();

  // 5-1. 対象ユーザーの情報を取得
  const { data: targetUser, error: fetchError } = await supabaseAdmin
    .from('profiles')
    .select('user_id, role')
    .eq('user_id', targetUserId)
    .eq('org_id', org.orgId)
    .single();

  if (fetchError || !targetUser) {
    console.error('[changeUserRole] User fetch error:', fetchError);
    return { success: false, error: '対象ユーザーが見つかりません' };
  }

  const oldRole = targetUser.role;

  // 5-2. ownerのロール変更は禁止
  if (targetUser.role === 'owner') {
    return {
      success: false,
      error: 'ownerのロールは変更できません。owner権限を譲渡する場合は専用の譲渡機能を使用してください。',
    };
  }

  // 5-3. 変更先ロールがownerの場合も禁止
  if (newRole === 'owner') {
    return {
      success: false,
      error: 'この機能ではownerロールへの変更はできません。owner権限の譲渡は専用の譲渡機能を使用してください。',
    };
  }

  // 6. ロール変更処理
  const { error: updateError } = await supabaseAdmin
    .from('profiles')
    .update({ role: newRole, updated_at: new Date().toISOString() })
    .eq('user_id', targetUserId)
    .eq('org_id', org.orgId);

  if (updateError) {
    console.error('[changeUserRole] Role update error:', updateError);
    return { success: false, error: 'ロールの変更に失敗しました' };
  }

  // 7. 監査ログ記録
  const logResult = await logActivity(supabaseAdmin, {
    orgId: org.orgId,
    userId: currentUserId,
    action: 'member.role_changed',
    payload: {
      target_user_id: targetUserId,
      old_role: oldRole,
      new_role: newRole,
      timestamp: new Date().toISOString(),
    },
  });

  if (logResult.error) {
    console.warn('[changeUserRole] Activity log failed:', logResult.error);
    // 監査ログ失敗は致命的エラーではないが、ワーニングを出す
  }

  // 8. 成功を返す
  return {
    success: true,
    nextUrl: '/members',
  };
}

/**
 * ユーザーを削除/無効化する
 *
 * @param targetUserId - 対象ユーザーのID
 * @returns ActionResult
 */
export async function removeUser(
  targetUserId: string
): Promise<ActionResult> {
  // 1. 入力バリデーション
  if (!targetUserId || typeof targetUserId !== 'string') {
    return {
      success: false,
      error: 'ユーザーIDが不正です',
    };
  }

  // 2. 権限チェック
  const roleContext = await getCurrentRole();
  const currentUserRole = roleContext?.role;
  if (!currentUserRole || !hasRole(currentUserRole, 'admin')) {
    return {
      success: false,
      error: 'この操作を行う権限がありません',
    };
  }

  // 3. 現在の組織を取得
  const org = await getCurrentOrg();
  if (!org) {
    return {
      success: false,
      error: '組織情報が見つかりません',
    };
  }

  // 4. 現在のユーザーIDを取得
  const supabase = await createServerClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  const currentUserId = user?.id;
  if (!currentUserId) {
    return {
      success: false,
      error: '認証セッションが見つかりません',
    };
  }

  // 5. Service Role Keyで操作
  const supabaseAdmin = getSupabaseAdmin();

  // 5-1. 対象ユーザーの情報を取得
  const { data: targetUser, error: fetchError } = await supabaseAdmin
    .from('profiles')
    .select('user_id, role')
    .eq('user_id', targetUserId)
    .eq('org_id', org.orgId)
    .single();

  if (fetchError || !targetUser) {
    console.error('[removeUser] User fetch error:', fetchError);
    return { success: false, error: '対象ユーザーが見つかりません' };
  }

  // 5-2. ownerの削除は禁止
  if (targetUser.role === 'owner') {
    return {
      success: false,
      error: 'ownerは削除できません。owner権限を譲渡してから削除してください。',
    };
  }

  // 6-1. profilesテーブルから削除
  const { error: deleteError } = await supabaseAdmin
    .from('profiles')
    .delete()
    .eq('user_id', targetUserId)
    .eq('org_id', org.orgId);

  if (deleteError) {
    console.error('[removeUser] Delete error:', deleteError);
    return { success: false, error: 'ユーザーの削除に失敗しました' };
  }

  // 6-2. user_org_contextから削除
  await supabaseAdmin
    .from('user_org_context')
    .delete()
    .eq('user_id', targetUserId);

  // 6-3. Supabase Authからもユーザーを削除
  const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(targetUserId);

  if (authDeleteError) {
    console.error('[removeUser] Auth delete error:', authDeleteError);
    // Auth削除失敗は警告のみ（profilesは既に削除済み）
    console.warn('[removeUser] Profile deleted but auth user deletion failed');
  }

  // 7. 監査ログ記録
  const logResult = await logActivity(supabaseAdmin, {
    orgId: org.orgId,
    userId: currentUserId,
    action: 'member.removed',
    payload: {
      target_user_id: targetUserId,
      target_role: targetUser.role,
      timestamp: new Date().toISOString(),
    },
  });

  if (logResult.error) {
    console.warn('[removeUser] Activity log failed:', logResult.error);
    // 監査ログ失敗は致命的エラーではないが、ワーニングを出す
  }

  // 8. 成功を返す
  return {
    success: true,
    nextUrl: '/members',
  };
}

/**
 * ユーザー情報を更新する
 *
 * @param targetUserId - 対象ユーザーのID
 * @param name - 新しい氏名
 * @param email - 新しいメールアドレス
 * @param newRole - 新しいロール（member/admin）
 * @param password - 新しいパスワード（任意）
 * @returns ActionResult
 */
export async function updateUser(
  targetUserId: string,
  name: string,
  email: string,
  newRole: Role,
  password?: string
): Promise<ActionResult> {
  // 1. 入力バリデーション
  if (!targetUserId || typeof targetUserId !== 'string') {
    return {
      success: false,
      error: 'ユーザーIDが不正です',
    };
  }

  if (!name || name.trim().length === 0) {
    return {
      success: false,
      error: '氏名を入力してください',
    };
  }

  if (!email || typeof email !== 'string') {
    return {
      success: false,
      error: 'メールアドレスが不正です',
    };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return {
      success: false,
      error: 'メールアドレスの形式が正しくありません',
    };
  }

  if (!newRole || !['owner', 'member', 'admin'].includes(newRole)) {
    return {
      success: false,
      error: 'ロールはowner, member, adminのいずれかを指定してください',
    };
  }

  // パスワードが指定されている場合のバリデーション
  if (password && password.length < 6) {
    return {
      success: false,
      error: 'パスワードは6文字以上で指定してください',
    };
  }

  // 2. 権限チェック
  const roleContext = await getCurrentRole();
  const currentUserRole = roleContext?.role;
  if (!currentUserRole || !hasRole(currentUserRole, 'admin')) {
    return {
      success: false,
      error: 'この操作を行う権限がありません',
    };
  }

  // 3. 現在の組織を取得
  const org = await getCurrentOrg();
  if (!org) {
    return {
      success: false,
      error: '組織情報が見つかりません',
    };
  }

  // 4. 現在のユーザーIDを取得
  const supabase = await createServerClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  const currentUserId = user?.id;
  if (!currentUserId) {
    return {
      success: false,
      error: '認証セッションが見つかりません',
    };
  }

  // 5. Service Role Keyで操作
  const supabaseAdmin = getSupabaseAdmin();

  // 5-1. 対象ユーザーの情報を取得
  const { data: targetUser, error: fetchError } = await supabaseAdmin
    .from('profiles')
    .select('user_id, role')
    .eq('user_id', targetUserId)
    .eq('org_id', org.orgId)
    .single();

  if (fetchError || !targetUser) {
    console.error('[updateUser] User fetch error:', fetchError);
    return { success: false, error: '対象ユーザーが見つかりません' };
  }

  const oldRole = targetUser.role;
  const isTargetOwner = targetUser.role === 'owner';

  // 5-2. ownerへのロール変更は禁止（譲渡機能を使用）
  if (!isTargetOwner && newRole === 'owner') {
    return {
      success: false,
      error: 'この機能ではownerロールへの変更はできません。',
    };
  }

  // 5-3. ownerの場合、ロール変更が試みられていたら拒否
  if (isTargetOwner && newRole !== 'owner') {
    return {
      success: false,
      error: 'ownerのロールは変更できません。',
    };
  }

  // 6. Auth情報を更新（メールアドレス・氏名・パスワード）
  const authUpdateData: {
    email: string;
    email_confirm: boolean;
    user_metadata: { name: string };
    password?: string;
  } = {
    email,
    email_confirm: true,
    user_metadata: {
      name: name.trim(),
    },
  };

  // パスワードが指定されている場合のみ追加
  if (password) {
    authUpdateData.password = password;
  }

  const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, authUpdateData);

  if (authUpdateError) {
    console.error('[updateUser] Auth update error:', authUpdateError);
    if (authUpdateError.message.includes('already been registered')) {
      return { success: false, error: 'このメールアドレスは既に使用されています' };
    }
    return { success: false, error: 'ユーザー情報の更新に失敗しました' };
  }

  // 7. ロール変更処理（ownerの場合はスキップ）
  if (!isTargetOwner) {
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ role: newRole, updated_at: new Date().toISOString() })
      .eq('user_id', targetUserId)
      .eq('org_id', org.orgId);

    if (updateError) {
      console.error('[updateUser] Role update error:', updateError);
      return { success: false, error: 'ロールの変更に失敗しました' };
    }
  }

  // 8. 監査ログ記録
  const logResult = await logActivity(supabaseAdmin, {
    orgId: org.orgId,
    userId: currentUserId,
    action: 'member.updated',
    payload: {
      target_user_id: targetUserId,
      old_role: oldRole,
      new_role: newRole,
      new_email: email,
      new_name: name.trim(),
      password_changed: !!password,
      timestamp: new Date().toISOString(),
    },
  });

  if (logResult.error) {
    console.warn('[updateUser] Activity log failed:', logResult.error);
  }

  // 9. 成功を返す
  return {
    success: true,
    nextUrl: '/members',
  };
}
