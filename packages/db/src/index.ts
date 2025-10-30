/**
 * Supabaseクライアント
 *
 * Server / Client の2種類のSupabaseクライアントを提供する。
 * - Server側: Cookie ベースの認証セッション管理（@supabase/ssr）
 * - Client側: Anon Key使用、RLSで保護される
 *
 * 重要: RLSを無効化・バイパスする実装は許可しない。
 */

import { createServerClient as createSupabaseServerClient } from '@supabase/ssr';
import { createBrowserClient as createSupabseBrowserClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// 環境変数の取得
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

/**
 * サーバー側で使用するSupabaseクライアント（Cookie ベース）
 *
 * Next.js の cookies() を使用して、サーバー側でセッション管理を行う。
 * Server Actions, Route Handlers, Server Components で使用。
 *
 * 使用例:
 * ```typescript
 * import { createServerClient } from '@repo/db';
 *
 * const supabase = createServerClient();
 * const { data: { user } } = await supabase.auth.getUser();
 * ```
 */
export function createServerClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set. ' +
      'See infra/supabase/SETUP.md for setup instructions.'
    );
  }

  const cookieStore = cookies();

  return createSupabaseServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Server Component 内での set は無視（middleware で処理）
        }
      },
    },
  });
}

/**
 * クライアント側（ブラウザ）で使用するSupabaseクライアント
 *
 * Anon Keyを使用し、RLSで保護される。
 * React ComponentやClient Componentで使用。
 *
 * 使用例:
 * ```typescript
 * 'use client';
 * import { createBrowserClient } from '@repo/db';
 *
 * const supabase = createBrowserClient();
 * const { data: { user } } = await supabase.auth.getUser();
 * ```
 */
export function createBrowserClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set. ' +
      'See infra/supabase/SETUP.md for setup instructions.'
    );
  }

  return createSupabseBrowserClient(supabaseUrl, supabaseAnonKey);
}

// 将来的にはここでDatabase型定義をエクスポート
// export type Database = ...
