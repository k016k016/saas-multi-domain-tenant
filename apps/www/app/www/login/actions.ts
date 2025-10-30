'use server';

/**
 * ログイン関連の Server Actions
 *
 * 責務:
 * - Supabase OTP (Magic Link) の送信
 * - Supabase Email/Password ログイン
 *
 * 重要な設計方針:
 * - redirect()は使用しない。必ず{ success, nextUrl }を返す
 * - クライアント側でrouter.push(nextUrl)を使って遷移する
 */

import { createServerClient } from '@repo/db';
import type { ActionResult } from '@repo/config';
import { setOrgIdCookie } from '@repo/config';

/**
 * OTP (Magic Link) を送信する
 *
 * @param email - 送信先メールアドレス
 * @returns ActionResult
 */
export async function sendOTP(email: string): Promise<ActionResult> {
  try {
    const supabase = await createServerClient();

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        // Magic Link のリダイレクト先 (www の /auth/callback)
        emailRedirectTo: `${process.env.NEXT_PUBLIC_WWW_URL}/auth/callback`,
      },
    });

    if (error) {
      console.error('OTP送信エラー:', error);
      return {
        success: false,
        error: 'ログインリンクの送信に失敗しました',
      };
    }

    return {
      success: true,
    };
  } catch (err) {
    console.error('予期しないエラー:', err);
    return {
      success: false,
      error: '予期しないエラーが発生しました',
    };
  }
}

/**
 * Email/Password でログインする
 *
 * @param email - メールアドレス
 * @param password - パスワード
 * @returns ActionResult - 成功時は nextUrl に app ドメインを返す
 */
export async function signInWithPassword(
  email: string,
  password: string
): Promise<ActionResult> {
  try {
    const supabase = await createServerClient();

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.session) {
      console.error('Password ログインエラー:', error);
      return {
        success: false,
        error: 'メールアドレスまたはパスワードが正しくありません',
      };
    }

    const userId = data.session.user.id;

    // ユーザーが所属する組織を取得
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('org_id, role')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (profileError) {
      console.error('[signInWithPassword] Profile fetch failed:', JSON.stringify(profileError, null, 2));
    }

    // 最初の組織を active_org_id として設定
    if (profiles && profiles.length > 0) {
      const firstOrg = profiles[0];
      await setOrgIdCookie(firstOrg.org_id);

      // ログイン成功後は app ドメインに遷移
      return {
        success: true,
        nextUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://app.local.test:3002',
      };
    } else {
      // 組織に所属していない場合は組織切替ページへ
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://app.local.test:3002';
      return {
        success: true,
        nextUrl: `${appUrl}/switch-org`,
      };
    }
  } catch (err) {
    console.error('予期しないエラー:', err);
    return {
      success: false,
      error: '予期しないエラーが発生しました',
    };
  }
}
