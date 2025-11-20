'use server';

/**
 * サインアウト関連の Server Actions
 *
 * 責務:
 * - Supabase のセッションを破棄する
 * - WWW ドメインのサインインページにリダイレクトするための nextUrl を返す
 *
 * 重要な設計方針:
 * - redirect()は使用しない。必ず{ success, nextUrl }を返す
 * - クライアント側で window.location.assign(nextUrl) を使って遷移する
 */

import { createServerClient } from '@repo/db';
import type { ActionResult } from '@repo/config';

/**
 * サインアウトする
 *
 * @returns ActionResult - 成功時は nextUrl に www/login を返す
 */
export async function logoutAction(): Promise<ActionResult> {
  try {
    const supabase = await createServerClient();

    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error('サインアウトエラー:', error);
      return {
        success: false,
        error: 'サインアウトに失敗しました',
      };
    }

    // サインアウト成功後は www ドメインのサインインページに遷移
    const wwwLoginUrl =
      process.env.NEXT_PUBLIC_WWW_URL ||
      process.env.WWW_URL ||
      'http://www.local.test:3001';

    return {
      success: true,
      nextUrl: `${wwwLoginUrl}/login`,
    };
  } catch (err) {
    console.error('予期しないエラー:', err);
    return {
      success: false,
      error: '予期しないエラーが発生しました',
    };
  }
}
