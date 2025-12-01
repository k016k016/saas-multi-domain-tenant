'use server';

/**
 * パスワード更新 Server Actions
 *
 * 責務:
 * - 新パスワードの設定
 *
 * 重要な設計方針:
 * - redirect()は使用しない。必ず{ success, error?, nextUrl? }を返す
 * - クライアント側でrouter.push(nextUrl)を使って遷移する
 * - パスワード更新後はセッションをクリアしてログインページへ誘導
 */

import { createServerClient } from '@repo/db';
import type { ActionResult } from '@repo/config';

/**
 * パスワードを更新する
 *
 * @param password - 新しいパスワード
 * @param confirmPassword - 確認用パスワード
 * @returns ActionResult - 成功時は nextUrl にログインページを返す
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

    // セッション確認（recovery token から自動的にセッションが作成されている）
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error('[updatePassword] No session:', userError);
      return {
        success: false,
        error: 'セッションが無効です。もう一度パスワードリセットをリクエストしてください。',
      };
    }

    // パスワード更新
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      console.error('[updatePassword] Update failed:', error);
      return {
        success: false,
        error: 'パスワードの更新に失敗しました',
      };
    }

    // セッションをクリア（再ログインを促す）
    await supabase.auth.signOut();

    const wwwUrl =
      process.env.NEXT_PUBLIC_WWW_URL ||
      process.env.WWW_URL ||
      'http://www.local.test:3001';

    return {
      success: true,
      nextUrl: `${wwwUrl}/login?message=password_reset`,
    };
  } catch (err) {
    console.error('[updatePassword] Unexpected error:', err);
    return {
      success: false,
      error: '予期しないエラーが発生しました',
    };
  }
}
