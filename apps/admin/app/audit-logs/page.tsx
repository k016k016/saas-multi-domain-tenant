/**
 * admin ドメイン: /audit-logs
 *
 * 責務:
 * - 組織内の監査ログ一覧を表示
 * - 期間/アクション種別によるフィルタリング
 *
 * 権限:
 * - adminとownerのみアクセス可能
 */

import { getCurrentOrg, getCurrentRole } from '@repo/config';
import { getSupabaseAdmin, type AuditAction } from '@repo/db';
import { notFound, redirect } from 'next/navigation';

// cookies()を使用するため、動的レンダリングを強制
export const dynamic = 'force-dynamic';

interface ActivityLog {
  id: string;
  action: AuditAction;
  payload: Record<string, unknown>;
  created_at: string;
  user_id: string;
}

// アクション種別の日本語ラベル
const ACTION_LABELS: Record<string, string> = {
  org_switched: '組織切替',
  user_invited: 'ユーザー招待',
  role_changed: 'ロール変更',
  user_removed: 'ユーザー削除',
  user_updated: 'ユーザー更新',
  payment_updated: '支払い情報変更',
  org_suspended: '組織凍結',
  owner_transferred: 'オーナー権限譲渡',
};

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; days?: string }>;
}) {
  const org = await getCurrentOrg();
  const roleContext = await getCurrentRole();
  const currentUserRole = roleContext?.role;

  // ADMIN domain: admin/owner のみアクセス可能
  if (!currentUserRole || (currentUserRole !== 'admin' && currentUserRole !== 'owner')) {
    redirect('/unauthorized');
  }

  if (!org) {
    notFound();
  }

  const params = await searchParams;
  const actionFilter = params.action;
  const daysFilter = params.days ? parseInt(params.days, 10) : 7; // デフォルト7日間

  // フィルタリング用の開始日時を計算
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysFilter);

  // Supabase Admin APIで監査ログを取得
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from('activity_logs')
    .select('id, action, payload, created_at, user_id')
    .eq('org_id', org.orgId)
    .gte('created_at', startDate.toISOString())
    .order('created_at', { ascending: false })
    .limit(100);

  // アクション種別フィルタ
  if (actionFilter && actionFilter !== 'all') {
    query = query.eq('action', actionFilter);
  }

  const { data: logs, error } = await query;

  if (error) {
    console.error('[AuditLogsPage] Failed to fetch logs:', error);
  }

  const activityLogs: ActivityLog[] = logs || [];

  return (
    <div style={{ padding: '2rem', background: '#1a1a1a', minHeight: '100vh', color: '#e5e5e5' }}>
      <h1 style={{ marginBottom: '1.5rem' }}>監査ログ</h1>

      {/* フィルタリングフォーム */}
      <div style={{ marginBottom: '1.5rem', padding: '1rem', background: '#262626', borderRadius: '8px', border: '1px solid #404040' }}>
        <form method="get" style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <label htmlFor="action" style={{ display: 'block', fontSize: '0.875rem', color: '#a1a1aa', marginBottom: '0.5rem' }}>
              アクション種別
            </label>
            <select
              id="action"
              name="action"
              defaultValue={actionFilter || 'all'}
              style={{
                padding: '0.5rem',
                background: '#1a1a1a',
                color: '#e5e5e5',
                border: '1px solid #404040',
                borderRadius: '4px',
              }}
            >
              <option value="all">すべて</option>
              <option value="org_switched">組織切替</option>
              <option value="user_invited">ユーザー招待</option>
              <option value="role_changed">ロール変更</option>
              <option value="user_removed">ユーザー削除</option>
              <option value="user_updated">ユーザー更新</option>
              <option value="payment_updated">支払い情報変更</option>
              <option value="org_suspended">組織凍結</option>
              <option value="owner_transferred">オーナー権限譲渡</option>
            </select>
          </div>

          <div>
            <label htmlFor="days" style={{ display: 'block', fontSize: '0.875rem', color: '#a1a1aa', marginBottom: '0.5rem' }}>
              期間
            </label>
            <select
              id="days"
              name="days"
              defaultValue={daysFilter.toString()}
              style={{
                padding: '0.5rem',
                background: '#1a1a1a',
                color: '#e5e5e5',
                border: '1px solid #404040',
                borderRadius: '4px',
              }}
            >
              <option value="1">過去1日</option>
              <option value="7">過去7日</option>
              <option value="30">過去30日</option>
              <option value="90">過去90日</option>
            </select>
          </div>

          <button
            type="submit"
            style={{
              padding: '0.5rem 1rem',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            フィルタ適用
          </button>
        </form>
      </div>

      {/* 監査ログテーブル */}
      <div style={{ border: '1px solid #404040', borderRadius: '8px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#262626', borderBottom: '1px solid #404040' }}>
              <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 500, color: '#a1a1aa', textTransform: 'uppercase' }}>
                日時
              </th>
              <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 500, color: '#a1a1aa', textTransform: 'uppercase' }}>
                アクション
              </th>
              <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 500, color: '#a1a1aa', textTransform: 'uppercase' }}>
                ユーザーID
              </th>
              <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 500, color: '#a1a1aa', textTransform: 'uppercase' }}>
                詳細
              </th>
            </tr>
          </thead>
          <tbody>
            {activityLogs.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: '#71717a' }}>
                  監査ログが見つかりませんでした
                </td>
              </tr>
            ) : (
              activityLogs.map((log) => (
                <tr key={log.id} style={{ borderBottom: '1px solid #404040' }}>
                  <td style={{ padding: '1rem', fontSize: '0.875rem', whiteSpace: 'nowrap' }}>
                    {new Date(log.created_at).toLocaleString('ja-JP', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </td>
                  <td style={{ padding: '1rem', whiteSpace: 'nowrap' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '0.25rem 0.75rem',
                        background: '#1e3a8a',
                        color: '#93c5fd',
                        border: '1px solid #3b82f6',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                      }}
                    >
                      {ACTION_LABELS[log.action] || log.action}
                    </span>
                  </td>
                  <td style={{ padding: '1rem', fontSize: '0.875rem', fontFamily: 'monospace', color: '#a1a1aa' }}>
                    {log.user_id.substring(0, 8)}...
                  </td>
                  <td style={{ padding: '1rem', fontSize: '0.875rem' }}>
                    <details style={{ cursor: 'pointer' }}>
                      <summary style={{ color: '#60a5fa' }}>詳細を表示</summary>
                      <pre
                        style={{
                          marginTop: '0.5rem',
                          padding: '0.5rem',
                          background: '#262626',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          overflow: 'auto',
                          color: '#a1a1aa',
                        }}
                      >
                        {JSON.stringify(log.payload, null, 2)}
                      </pre>
                    </details>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 結果サマリー */}
      <div style={{ marginTop: '1rem', fontSize: '0.875rem', color: '#71717a' }}>
        {activityLogs.length > 0 && (
          <p>
            {activityLogs.length} 件のログを表示中（過去{daysFilter}日間
            {actionFilter && actionFilter !== 'all' && `、${ACTION_LABELS[actionFilter]}のみ`}
            ）
          </p>
        )}
      </div>
    </div>
  );
}
