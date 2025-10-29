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

import { getCurrentOrg, getCurrentRole, hasRole } from '@repo/config';
import type { ActionResult, Role } from '@repo/config';

/**
 * ユーザーを招待する
 *
 * @param email - 招待するユーザーのメールアドレス
 * @param role - 初期ロール（member/admin）
 * @returns ActionResult
 */
export async function inviteUser(
  email: string,
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

  if (!role || !['member', 'admin'].includes(role)) {
    return {
      success: false,
      error: 'ロールはmemberまたはadminを指定してください',
    };
  }

  // 2. 権限チェック
  const { role: currentUserRole } = await getCurrentRole();
  if (!hasRole(currentUserRole, 'admin')) {
    return {
      success: false,
      error: 'この操作を行う権限がありません',
    };
  }

  // 3. 現在の組織を取得
  const org = await getCurrentOrg();

  // 4. ユーザー招待処理
  // TODO: 実際にはSupabase Authの招待機能を使用
  //
  // 【実装パス】
  // import { createServerClient } from '@repo/db';
  // const supabase = createServerClient();
  //
  // // 4-1. 現在のユーザーIDを取得
  // const { data: { session } } = await supabase.auth.getSession();
  // const currentUserId = session?.user?.id;
  // if (!currentUserId) {
  //   return { success: false, error: '認証セッションが見つかりません' };
  // }
  //
  // // 4-2. 同じメールアドレスのユーザーが既に存在するか確認
  // const { data: existingUser } = await supabase
  //   .from('profiles')
  //   .select('id, email')
  //   .eq('org_id', org.orgId)
  //   .eq('email', email)
  //   .single();
  //
  // if (existingUser) {
  //   return { success: false, error: 'このメールアドレスは既に登録されています' };
  // }
  //
  // // 4-3. Supabase Auth経由で招待メールを送信
  // // ※ Service Role Key使用時のみ利用可能
  // const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(
  //   email,
  //   {
  //     data: {
  //       org_id: org.orgId,
  //       role: role,
  //       invited_by: currentUserId,
  //     },
  //     redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
  //   }
  // );
  //
  // if (inviteError) {
  //   console.error('[inviteUser] Invite error:', inviteError);
  //   return { success: false, error: '招待メールの送信に失敗しました' };
  // }
  //
  // // 4-4. profilesテーブルに仮ユーザーレコードを作成
  // const { error: profileError } = await supabase
  //   .from('profiles')
  //   .insert({
  //     user_id: inviteData.user.id, // 招待されたユーザーのID
  //     org_id: org.orgId,
  //     email: email,
  //     role: role,
  //     status: 'pending', // 招待メール未承認状態
  //     invited_at: new Date().toISOString(),
  //     invited_by: currentUserId,
  //   });
  //
  // if (profileError) {
  //   console.error('[inviteUser] Profile creation error:', profileError);
  //   return { success: false, error: 'ユーザーレコードの作成に失敗しました' };
  // }
  console.log(`[inviteUser] Inviting ${email} as ${role} to org ${org.orgId}`);

  // 5. 監査ログ記録
  // TODO: activity_logsテーブルに記録
  //
  // 【実装パス】
  // const { error: logError } = await supabase
  //   .from('activity_logs')
  //   .insert({
  //     user_id: currentUserId,
  //     org_id: org.orgId,
  //     action: 'user_invited',
  //     details: {
  //       invited_email: email,
  //       invited_role: role,
  //       invited_user_id: inviteData.user.id,
  //       timestamp: new Date().toISOString(),
  //     },
  //   });
  //
  // if (logError) {
  //   console.error('[inviteUser] Activity log error:', logError);
  //   // ログ失敗は致命的エラーではないが、ワーニングを出す
  // }

  // 6. 成功を返す
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
  const { role: currentUserRole } = await getCurrentRole();
  if (!hasRole(currentUserRole, 'admin')) {
    return {
      success: false,
      error: 'この操作を行う権限がありません',
    };
  }

  // 3. 現在の組織を取得
  const org = await getCurrentOrg();

  // 4. 対象ユーザーのロールを確認
  // TODO: 実際にはSupabase profilesテーブルから取得
  //
  // 【実装パス】
  // import { createServerClient } from '@repo/db';
  // const supabase = createServerClient();
  //
  // // 4-1. 現在のユーザーIDを取得
  // const { data: { session } } = await supabase.auth.getSession();
  // const currentUserId = session?.user?.id;
  // if (!currentUserId) {
  //   return { success: false, error: '認証セッションが見つかりません' };
  // }
  //
  // // 4-2. 対象ユーザーの情報を取得
  // const { data: targetUser, error: fetchError } = await supabase
  //   .from('profiles')
  //   .select('user_id, email, role')
  //   .eq('user_id', targetUserId)
  //   .eq('org_id', org.orgId)
  //   .single();
  //
  // if (fetchError || !targetUser) {
  //   console.error('[changeUserRole] User fetch error:', fetchError);
  //   return { success: false, error: '対象ユーザーが見つかりません' };
  // }
  //
  // const oldRole = targetUser.role;

  // ownerのロール変更は禁止
  // if (targetUser.role === 'owner') {
  //   return {
  //     success: false,
  //     error: 'ownerのロールは変更できません。owner権限を譲渡する場合は専用の譲渡機能を使用してください。',
  //   };
  // }

  // 5. ロール変更処理
  // TODO: 実際にはSupabase profilesテーブルを更新
  //
  // 【実装パス】
  // const { error: updateError } = await supabase
  //   .from('profiles')
  //   .update({ role: newRole, updated_at: new Date().toISOString() })
  //   .eq('user_id', targetUserId)
  //   .eq('org_id', org.orgId);
  //
  // if (updateError) {
  //   console.error('[changeUserRole] Role update error:', updateError);
  //   return { success: false, error: 'ロールの変更に失敗しました' };
  // }
  console.log(`[changeUserRole] Changing user ${targetUserId} role to ${newRole} in org ${org.orgId}`);

  // 6. 監査ログ記録
  // TODO: activity_logsテーブルに記録
  //
  // 【実装パス】
  // const { error: logError } = await supabase
  //   .from('activity_logs')
  //   .insert({
  //     user_id: currentUserId,
  //     org_id: org.orgId,
  //     action: 'role_changed',
  //     details: {
  //       target_user_id: targetUserId,
  //       target_email: targetUser.email,
  //       old_role: oldRole,
  //       new_role: newRole,
  //       timestamp: new Date().toISOString(),
  //     },
  //   });
  //
  // if (logError) {
  //   console.error('[changeUserRole] Activity log error:', logError);
  //   // ログ失敗は致命的エラーではないが、ワーニングを出す
  // }

  // 7. 成功を返す
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
  const { role: currentUserRole } = await getCurrentRole();
  if (!hasRole(currentUserRole, 'admin')) {
    return {
      success: false,
      error: 'この操作を行う権限がありません',
    };
  }

  // 3. 現在の組織を取得
  const org = await getCurrentOrg();

  // 4. 対象ユーザーのロールを確認
  // TODO: 実際にはSupabase profilesテーブルから取得
  //
  // 【実装パス】
  // import { createServerClient } from '@repo/db';
  // const supabase = createServerClient();
  //
  // // 4-1. 現在のユーザーIDを取得
  // const { data: { session } } = await supabase.auth.getSession();
  // const currentUserId = session?.user?.id;
  // if (!currentUserId) {
  //   return { success: false, error: '認証セッションが見つかりません' };
  // }
  //
  // // 4-2. 対象ユーザーの情報を取得
  // const { data: targetUser, error: fetchError } = await supabase
  //   .from('profiles')
  //   .select('user_id, email, role')
  //   .eq('user_id', targetUserId)
  //   .eq('org_id', org.orgId)
  //   .single();
  //
  // if (fetchError || !targetUser) {
  //   console.error('[removeUser] User fetch error:', fetchError);
  //   return { success: false, error: '対象ユーザーが見つかりません' };
  // }

  // ownerの削除は禁止
  // if (targetUser.role === 'owner') {
  //   return {
  //     success: false,
  //     error: 'ownerは削除できません。owner権限を譲渡してから削除してください。',
  //   };
  // }

  // 5. ユーザー削除/無効化処理
  // TODO: 実際にはSupabase profilesテーブルを更新
  //
  // 【実装パス】
  // 論理削除を推奨（監査証跡を保持）:
  // const { error: deleteError } = await supabase
  //   .from('profiles')
  //   .update({
  //     status: 'inactive',
  //     deleted_at: new Date().toISOString(),
  //     deleted_by: currentUserId,
  //   })
  //   .eq('user_id', targetUserId)
  //   .eq('org_id', org.orgId);
  //
  // 物理削除の場合（監査要件に注意）:
  // const { error: deleteError } = await supabase
  //   .from('profiles')
  //   .delete()
  //   .eq('user_id', targetUserId)
  //   .eq('org_id', org.orgId);
  //
  // if (deleteError) {
  //   console.error('[removeUser] Delete error:', deleteError);
  //   return { success: false, error: 'ユーザーの削除に失敗しました' };
  // }
  console.log(`[removeUser] Removing user ${targetUserId} from org ${org.orgId}`);

  // 6. 監査ログ記録
  // TODO: activity_logsテーブルに記録
  //
  // 【実装パス】
  // const { error: logError } = await supabase
  //   .from('activity_logs')
  //   .insert({
  //     user_id: currentUserId,
  //     org_id: org.orgId,
  //     action: 'user_removed',
  //     details: {
  //       target_user_id: targetUserId,
  //       target_email: targetUser.email,
  //       target_role: targetUser.role,
  //       timestamp: new Date().toISOString(),
  //     },
  //   });
  //
  // if (logError) {
  //   console.error('[removeUser] Activity log error:', logError);
  //   // ログ失敗は致命的エラーではないが、ワーニングを出す
  // }

  // 7. 成功を返す
  return {
    success: true,
    nextUrl: '/members',
  };
}
