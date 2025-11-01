import * as _supabase_supabase_js from '@supabase/supabase-js';
import { SupabaseClient } from '@supabase/supabase-js';

/**
 * 監査ログ (activity_logs) ヘルパー
 *
 * 重要な設計方針:
 * - すべての重要操作は activity_logs テーブルに記録する
 * - org_id と user_id は必須（テナント分離と監査証跡のため）
 * - action は定義済みの文字列定数を使用する
 * - payload には操作の詳細をJSON形式で記録する
 *
 * 対象操作:
 * - 組織切替 (org_switched)
 * - ユーザー招待 (user_invited)
 * - ロール変更 (role_changed)
 * - ユーザー削除 (user_removed)
 * - 支払い情報変更 (payment_updated) ※将来実装
 * - 組織凍結/廃止 (org_suspended) ※将来実装
 * - owner権限譲渡 (owner_transferred) ※将来実装
 */

/**
 * 監査ログのアクション種別
 */
type AuditAction = 'org_switched' | 'user_invited' | 'role_changed' | 'user_removed' | 'payment_updated' | 'org_suspended' | 'owner_transferred';
/**
 * 監査ログのペイロード型
 */
interface AuditLogPayload {
    /** 組織ID（必須） */
    orgId: string;
    /** 実行ユーザーID（必須） */
    userId: string;
    /** アクション種別（必須） */
    action: AuditAction;
    /** 詳細情報（任意）- JSON形式で操作の詳細を記録 */
    payload?: Record<string, unknown>;
}
/**
 * 監査ログを記録する
 *
 * @param supabase - Supabase クライアント
 * @param logData - ログデータ
 * @returns エラーがあれば返す
 *
 * @example
 * ```typescript
 * await logActivity(supabase, {
 *   orgId: 'org-123',
 *   userId: 'user-456',
 *   action: 'org_switched',
 *   payload: {
 *     from: 'org-111',
 *     to: 'org-123',
 *     timestamp: new Date().toISOString()
 *   }
 * });
 * ```
 */
declare function logActivity(supabase: SupabaseClient, logData: AuditLogPayload): Promise<{
    error?: string;
}>;

/**
 * Supabaseクライアント
 *
 * Server / Client の2種類のSupabaseクライアントを提供する。
 * - Server側: Cookie ベースの認証セッション管理（@supabase/ssr）
 * - Client側: Anon Key使用、RLSで保護される
 *
 * 重要: RLSを無効化・バイパスする実装は許可しない。
 */
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
declare function createServerClient(): Promise<_supabase_supabase_js.SupabaseClient<any, "public", "public", any, any>>;
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
declare function createBrowserClient(): _supabase_supabase_js.SupabaseClient<any, "public", "public", any, any>;
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
declare function getSupabaseAdmin(): any;

export { type AuditAction, type AuditLogPayload, createBrowserClient, createServerClient, getSupabaseAdmin, logActivity };
