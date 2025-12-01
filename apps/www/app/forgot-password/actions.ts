'use server';

/**
 * パスワードリセットリクエスト Server Actions
 *
 * 責務:
 * - パスワードリセットメールの送信
 *
 * 重要な設計方針:
 * - redirect()は使用しない。必ず{ success, error? }を返す
 * - セキュリティ: メール存在確認を防ぐため、エラー時も成功を返す
 */

import { createServerClient } from '@repo/db';
import type { ActionResult } from '@repo/config';

/**
 * パスワードリセットメールを送信する
 *
 * @param email - メールアドレス
 * @returns ActionResult - 常に成功を返す（セキュリティのため）
 */
export async function requestPasswordReset(email: string): Promise<ActionResult> {
  // バリデーション: 空チェック
  if (!email || email.trim() === '') {
    return {
      success: false,
      error: 'メールアドレスを入力してください',
    };
  }

  // バリデーション: メール形式チェック
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return {
      success: false,
      error: 'メールアドレスの形式が正しくありません',
    };
  }

  try {
    const supabase = await createServerClient();
    const wwwUrl =
      process.env.NEXT_PUBLIC_WWW_URL ||
      process.env.WWW_URL ||
      'http://www.local.test:3001';

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${wwwUrl}/auth/callback?type=recovery`,
    });

    // セキュリティ: エラー時もログのみ（ユーザーにはメール存在を漏らさない）
    if (error) {
      console.error('[requestPasswordReset] Error:', error);
    }

    // 常に成功を返す（メール存在確認を防ぐ）
    return { success: true };
  } catch (err) {
    console.error('[requestPasswordReset] Unexpected error:', err);
    // 予期しないエラーでも成功を返す（セキュリティ）
    return { success: true };
  }
}
