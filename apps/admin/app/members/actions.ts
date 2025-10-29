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
  // - supabase.auth.admin.inviteUserByEmail(email, { data: { org_id, role } })
  // - 招待メールが自動送信される
  // - ユーザーがリンクをクリックしてサインアップ完了
  console.log(`[inviteUser] Inviting ${email} as ${role} to org ${org.orgId}`);

  // TODO: profilesテーブルに仮ユーザーを作成
  // INSERT INTO profiles (org_id, email, role, status, invited_at, invited_by)
  // VALUES (org_id, email, role, 'pending', NOW(), current_user_id)

  // 5. 監査ログ記録
  // TODO: activity_logsテーブルに記録
  // INSERT INTO activity_logs (user_id, org_id, action, details)
  // VALUES (current_user_id, org_id, 'user_invited', { email, role })

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
  // const targetUser = await getUser(targetUserId, org.orgId);

  // ownerのロール変更は禁止
  // if (targetUser.role === 'owner') {
  //   return {
  //     success: false,
  //     error: 'ownerのロールは変更できません',
  //   };
  // }

  // 5. ロール変更処理
  // TODO: 実際にはSupabase profilesテーブルを更新
  // UPDATE profiles SET role = newRole WHERE user_id = targetUserId AND org_id = org.orgId
  console.log(`[changeUserRole] Changing user ${targetUserId} role to ${newRole} in org ${org.orgId}`);

  // 6. 監査ログ記録
  // TODO: activity_logsテーブルに記録
  // INSERT INTO activity_logs (user_id, org_id, action, details)
  // VALUES (current_user_id, org_id, 'role_changed', { target_user_id, old_role, new_role })

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
  // const targetUser = await getUser(targetUserId, org.orgId);

  // ownerの削除は禁止
  // if (targetUser.role === 'owner') {
  //   return {
  //     success: false,
  //     error: 'ownerは削除できません。owner権限を譲渡してから削除してください。',
  //   };
  // }

  // 5. ユーザー削除/無効化処理
  // TODO: 実際にはSupabase profilesテーブルを更新
  // - 論理削除の場合: UPDATE profiles SET status = 'inactive' WHERE user_id = targetUserId AND org_id = org.orgId
  // - 物理削除の場合: DELETE FROM profiles WHERE user_id = targetUserId AND org_id = org.orgId
  console.log(`[removeUser] Removing user ${targetUserId} from org ${org.orgId}`);

  // 6. 監査ログ記録
  // TODO: activity_logsテーブルに記録
  // INSERT INTO activity_logs (user_id, org_id, action, details)
  // VALUES (current_user_id, org_id, 'user_removed', { target_user_id })

  // 7. 成功を返す
  return {
    success: true,
    nextUrl: '/members',
  };
}
