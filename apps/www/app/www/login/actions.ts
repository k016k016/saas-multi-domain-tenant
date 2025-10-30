'use server';

/**
 * ログイン関連の Server Actions
 *
 * 責務:
 * - Supabase OTP (Magic Link) の送信
 */

import { createServerClient } from '@repo/db';

export async function sendOTP(email: string): Promise<{ error?: string }> {
  try {
    const supabase = createServerClient();

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        // Magic Link のリダイレクト先 (www の /auth/callback)
        emailRedirectTo: `${process.env.NEXT_PUBLIC_WWW_URL}/auth/callback`,
      },
    });

    if (error) {
      console.error('OTP送信エラー:', error);
      return { error: 'ログインリンクの送信に失敗しました' };
    }

    return {};
  } catch (err) {
    console.error('予期しないエラー:', err);
    return { error: '予期しないエラーが発生しました' };
  }
}
