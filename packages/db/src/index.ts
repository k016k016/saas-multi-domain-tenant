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
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

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
/**
 * createServerClient(): Next.js 16準拠
 * - 呼び出し側は必ず `await createServerClient()` すること
 * - 内部で `await cookies()` を使用（非同期）
 * - middleware(Edge) からの呼び出しは禁止
 */
export async function createServerClient() {
  // 環境変数を関数内で読み込む（モジュールトップレベルではなく）
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set. ' +
      'See infra/supabase/SETUP.md for setup instructions.'
    );
  }

  const cookieStore = await cookies();

  return createSupabaseServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, {
              ...options,
              // サブドメイン間でSupabase Sessionを共有するため、domain を .local.test に設定
              domain: '.local.test',
              // セキュリティ属性の明示的設定
              httpOnly: true,
              sameSite: 'lax',
            })
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
  // 環境変数を関数内で読み込む（モジュールトップレベルではなく）
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set. ' +
      'See infra/supabase/SETUP.md for setup instructions.'
    );
  }

  return createSupabseBrowserClient(supabaseUrl, supabaseAnonKey);
}

/**
 * Supabase Admin API クライアント（Service Role Key使用）
 *
 * RLSをバイパスして全データにアクセスできるため、使用は慎重に。
 * サーバー側（Server Actions, Route Handlers）でのみ使用可能。
 *
 * 使用例:
 * ```typescript
 * import { getSupabaseAdmin } from '@repo/db';
 *
 * const supabase = getSupabaseAdmin();
 * const { data, error } = await supabase.from('activity_logs').select('*');
 * ```
 */
export function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set. ' +
      'See infra/supabase/SETUP.md for setup instructions.'
    );
  }

  // Service Role Keyを使用した Admin API クライアント
  // 注意: RLSをバイパスするため、認可チェックはアプリケーション層で行う必要がある
  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// 将来的にはここでDatabase型定義をエクスポート
// export type Database = ...

// 監査ログヘルパーをエクスポート
export { logActivity, type AuditAction, type AuditLogPayload } from './audit';
