/**
 * Supabaseクライアント
 *
 * Server / Client の2種類のSupabaseクライアントを提供する。
 * - Server側: Service Role Key使用、RLSをバイパス可能（慎重に使用）
 * - Client側: Anon Key使用、RLSで保護される
 *
 * 重要: RLSを無効化・バイパスする実装は許可しない。
 *       Service Role Keyは信頼できるサーバー側コードでのみ使用すること。
 */

import { createClient } from '@supabase/supabase-js';

// 環境変数の取得
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/**
 * サーバー側で使用するSupabaseクライアント
 *
 * Service Role Keyを使用するため、RLSをバイパス可能。
 * 信頼できるサーバー側のコード（Server Actions, API Routes, middleware等）でのみ使用。
 *
 * 使用例:
 * ```typescript
 * import { createServerClient } from '@repo/db';
 *
 * const supabase = createServerClient();
 * const { data, error } = await supabase.from('profiles').select('*');
 * ```
 */
export function createServerClient() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error(
      'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment variables. ' +
      'See infra/supabase/SETUP.md for setup instructions.'
    );
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
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
 * const { data, error } = await supabase.from('profiles').select('*');
 * ```
 */
export function createBrowserClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'SUPABASE_URL and SUPABASE_ANON_KEY must be set in environment variables. ' +
      'See infra/supabase/SETUP.md for setup instructions.'
    );
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
    },
  });
}

/**
 * レガシー互換用のデフォルトエクスポート（非推奨）
 *
 * @deprecated createServerClient() または createBrowserClient() を使用してください。
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 将来的にはここでDatabase型定義をエクスポート
// export type Database = ...
