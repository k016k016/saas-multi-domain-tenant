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

import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * 監査ログのアクション種別
 */
export type AuditAction =
  | 'org_switched'          // 組織切替
  | 'user_invited'          // ユーザー招待
  | 'role_changed'          // ロール変更
  | 'user_removed'          // ユーザー削除/無効化
  | 'user_updated'          // ユーザー情報更新
  | 'organization_created'  // 組織作成（ops などからの新規作成）
  | 'payment_updated'       // 支払い情報変更（将来実装）
  | 'org_suspended'         // 組織凍結/廃止（将来実装）
  | 'owner_transferred';    // owner権限譲渡（将来実装）

/**
 * 監査ログのペイロード型
 */
export interface AuditLogPayload {
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
export async function logActivity(
  supabase: SupabaseClient,
  logData: AuditLogPayload
): Promise<{ error?: string }> {
  try {
    const { error } = await supabase.from('activity_logs').insert({
      org_id: logData.orgId,
      user_id: logData.userId,
      action: logData.action,
      payload: logData.payload ?? {},
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error('[logActivity] Insert failed:', error);
      return { error: error.message };
    }

    return {};
  } catch (err) {
    console.error('[logActivity] Unexpected error:', err);
    return { error: '監査ログの記録に失敗しました' };
  }
}
