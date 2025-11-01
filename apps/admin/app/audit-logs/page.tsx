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
const ACTION_LABELS: Record<AuditAction, string> = {
  org_switched: '組織切替',
  user_invited: 'ユーザー招待',
  role_changed: 'ロール変更',
  user_removed: 'ユーザー削除',
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
    <div className="container mx-auto p-6 max-w-7xl">
      <h1 className="text-3xl font-bold mb-6">監査ログ</h1>

      {/* フィルタリングフォーム */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <form method="get" className="flex gap-4 items-end flex-wrap">
          <div>
            <label htmlFor="action" className="block text-sm font-medium text-gray-700 mb-1">
              アクション種別
            </label>
            <select
              id="action"
              name="action"
              defaultValue={actionFilter || 'all'}
              className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">すべて</option>
              <option value="org_switched">組織切替</option>
              <option value="user_invited">ユーザー招待</option>
              <option value="role_changed">ロール変更</option>
              <option value="user_removed">ユーザー削除</option>
              <option value="payment_updated">支払い情報変更</option>
              <option value="org_suspended">組織凍結</option>
              <option value="owner_transferred">オーナー権限譲渡</option>
            </select>
          </div>

          <div>
            <label htmlFor="days" className="block text-sm font-medium text-gray-700 mb-1">
              期間
            </label>
            <select
              id="days"
              name="days"
              defaultValue={daysFilter.toString()}
              className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="1">過去1日</option>
              <option value="7">過去7日</option>
              <option value="30">過去30日</option>
              <option value="90">過去90日</option>
            </select>
          </div>

          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            フィルタ適用
          </button>
        </form>
      </div>

      {/* 監査ログテーブル */}
      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                日時
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                アクション
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                ユーザーID
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                詳細
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {activityLogs.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                  監査ログが見つかりませんでした
                </td>
              </tr>
            ) : (
              activityLogs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(log.created_at).toLocaleString('ja-JP', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                      {ACTION_LABELS[log.action] || log.action}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500">
                    {log.user_id.substring(0, 8)}...
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    <details className="cursor-pointer">
                      <summary className="text-blue-600 hover:text-blue-800">詳細を表示</summary>
                      <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-x-auto">
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
      <div className="mt-4 text-sm text-gray-600">
        {activityLogs.length > 0 && (
          <p>
            {activityLogs.length} 件のログを表示中（過去{daysFilter}日間
            {actionFilter && actionFilter !== 'all' && `、${ACTION_LABELS[actionFilter as AuditAction]}のみ`}
            ）
          </p>
        )}
      </div>
    </div>
  );
}
