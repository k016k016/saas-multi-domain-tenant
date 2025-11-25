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
 * - 組織切替 (org.switched)
 * - メンバー招待 (member.invited)
 * - ロール変更 (member.role_changed)
 * - メンバー削除 (member.removed)
 * - 支払い情報変更 (payment.updated) ※将来実装
 * - 組織凍結/廃止 (org.suspended) ※将来実装
 * - owner権限譲渡 (org.ownership_transferred) ※将来実装
 */

import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * 監査ログのアクション種別
 */
export type AuditAction =
  | 'org.switched'              // 組織切替
  | 'member.invited'            // メンバー招待
  | 'member.role_changed'       // ロール変更
  | 'member.removed'            // メンバー削除/無効化
  | 'member.updated'            // メンバー情報更新
  | 'member.deleted'            // メンバー削除（ops操作）
  | 'organization.created'      // 組織作成（ops などからの新規作成）
  | 'org.updated'               // 組織情報更新（ops操作）
  | 'org.deleted'               // 組織削除（ops操作）
  | 'payment.updated'           // 支払い情報変更（将来実装）
  | 'org.suspended'             // 組織凍結/廃止（将来実装）
  | 'org.ownership_transferred' // owner権限譲渡（将来実装）
  | 'org.frozen'                // 組織凍結
  | 'org.unfrozen'              // 凍結解除
  | 'org.archived';             // 組織廃止

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
 *   action: 'org.switched',
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
