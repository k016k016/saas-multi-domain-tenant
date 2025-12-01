'use server';

/**
 * プロフィール編集 Server Actions
 *
 * 責務:
 * - 自分の名前の更新
 * - 自分のパスワードの更新
 *
 * 重要な設計方針:
 * - redirect()は使用しない。必ず{ success, error?, nextUrl? }を返す
 * - クライアント側でrouter.push(nextUrl)を使って遷移する
 * - すべての操作はactivity_logsに記録する
 */

import { createServerClient, getSupabaseAdmin, logActivity } from '@repo/db';
import { getCurrentOrg } from '@repo/config';
import type { ActionResult } from '@repo/config';

/**
 * 名前を更新する
 *
 * @param name - 新しい名前
 * @returns ActionResult
 */
export async function updateProfile(name: string): Promise<ActionResult> {
  // バリデーション: 空チェック
  if (!name || name.trim() === '') {
    return {
      success: false,
      error: '名前を入力してください',
    };
  }

  try {
    const supabase = await createServerClient();

    // セッション確認
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error('[updateProfile] No session:', userError);
      return {
        success: false,
        error: 'セッションが無効です。再度ログインしてください。',
      };
    }

    const oldName = user.user_metadata?.name || '';

    // 名前更新
    const { error } = await supabase.auth.updateUser({
      data: { name: name.trim() },
    });

    if (error) {
      console.error('[updateProfile] Update failed:', error);
      return {
        success: false,
        error: '名前の更新に失敗しました',
      };
    }

    // 監査ログ記録
    const org = await getCurrentOrg();
    if (org) {
      const supabaseAdmin = getSupabaseAdmin();
      const logResult = await logActivity(supabaseAdmin, {
        orgId: org.orgId,
        userId: user.id,
        action: 'member.updated',
        payload: {
          target_user_id: user.id,
          old_name: oldName,
          new_name: name.trim(),
          self_update: true,
          timestamp: new Date().toISOString(),
        },
      });

      if (logResult.error) {
        console.warn('[updateProfile] Activity log failed:', logResult.error);
      }
    }

    return {
      success: true,
    };
  } catch (err) {
    console.error('[updateProfile] Unexpected error:', err);
    return {
      success: false,
      error: '予期しないエラーが発生しました',
    };
  }
}

/**
 * パスワードを更新する
 *
 * @param password - 新しいパスワード
 * @param confirmPassword - 確認用パスワード
 * @returns ActionResult
 */
export async function updatePassword(
  password: string,
  confirmPassword: string
): Promise<ActionResult> {
  // バリデーション: 空チェック
  if (!password || password.trim() === '') {
    return {
      success: false,
      error: 'パスワードを入力してください',
    };
  }

  // バリデーション: 最小文字数
  if (password.length < 6) {
    return {
      success: false,
      error: 'パスワードは6文字以上で入力してください',
    };
  }

  // バリデーション: 確認用パスワード一致
  if (password !== confirmPassword) {
    return {
      success: false,
      error: 'パスワードが一致しません',
    };
  }

  try {
    const supabase = await createServerClient();

    // セッション確認
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error('[updatePassword] No session:', userError);
      return {
        success: false,
        error: 'セッションが無効です。再度ログインしてください。',
      };
    }

    // パスワード更新 (Admin APIを使用 - Server ActionsではセッションベースのupdateUserが動作しないため)
    const supabaseAdmin = getSupabaseAdmin();
    const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, { password });

    if (error) {
      console.error('[updatePassword] Update failed:', error);
      return {
        success: false,
        error: 'パスワードの更新に失敗しました',
      };
    }

    // 監査ログ記録
    const org = await getCurrentOrg();
    if (org) {
      const logResult = await logActivity(supabaseAdmin, {
        orgId: org.orgId,
        userId: user.id,
        action: 'member.updated',
        payload: {
          target_user_id: user.id,
          password_changed: true,
          self_update: true,
          timestamp: new Date().toISOString(),
        },
      });

      if (logResult.error) {
        console.warn('[updatePassword] Activity log failed:', logResult.error);
      }
    }

    return {
      success: true,
    };
  } catch (err) {
    console.error('[updatePassword] Unexpected error:', err);
    return {
      success: false,
      error: '予期しないエラーが発生しました',
    };
  }
}
