'use server';

/**
 * OPS専用 サインイン Server Actions
 *
 * 責務:
 * - Supabase Email/Password サインイン（ops管理者用）
 * - 成功時は OPS ドメインへリダイレクト
 *
 * 重要な設計方針:
 * - redirect()は使用しない。必ず{ success, nextUrl }を返す
 * - クライアント側でrouter.push(nextUrl)を使って遷移する
 * - このログインページのURLは非公開（知っている人のみアクセス）
 */

import { createServerClient } from '@repo/db';
import type { ActionResult } from '@repo/config';

/**
 * Email/Password でサインインする（OPS用）
 *
 * @param email - メールアドレス
 * @param password - パスワード
 * @returns ActionResult - 成功時は nextUrl に OPS ドメインを返す
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
      // テスト環境ではログを抑制（本番環境ではセキュリティ監査のため記録）
      if (process.env.NODE_ENV !== 'test') {
        console.error('OPS Password サインインエラー:', error);
      }
      return {
        success: false,
        error: 'メールアドレスまたはパスワードが無効です',
      };
    }

    // Supabase Session は createServerClient() が自動的に Cookie を管理
    // サインイン成功後は OPS ドメインに遷移
    const opsUrl =
      process.env.NEXT_PUBLIC_OPS_URL ||
      process.env.OPS_URL ||
      'http://ops.local.test:3005';

    return {
      success: true,
      nextUrl: opsUrl,
    };
  } catch (err) {
    console.error('予期しないエラー:', err);
    return {
      success: false,
      error: '予期しないエラーが発生しました',
    };
  }
}
