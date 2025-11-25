/**
 * admin ドメイン: /audit-logs
 *
 * 責務:
 * - 組織内の監査ログ一覧を表示
 * - 期間/アクション種別によるフィルタリング
 * - 実行者・対象の情報をわかりやすく表示
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

interface UserInfo {
  id: string;
  email: string;
  name: string;
}

// アクション種別の日本語ラベル
const ACTION_LABELS: Record<string, string> = {
  'org.switched': '組織切替',
  'member.invited': 'メンバー招待',
  'member.role_changed': 'ロール変更',
  'member.removed': 'メンバー削除',
  'member.updated': 'メンバー更新',
  'member.deleted': 'メンバー削除（ops）',
  'organization.created': '組織作成',
  'org.updated': '組織更新（ops）',
  'org.deleted': '組織削除（ops）',
  'payment.updated': '支払い情報変更',
  'org.suspended': '組織凍結',
  'org.ownership_transferred': 'オーナー権限譲渡',
  'org.frozen': '組織凍結',
  'org.unfrozen': '凍結解除',
  'org.archived': '組織廃止',
};

// payloadから対象・詳細を日本語で生成
function formatDetails(action: AuditAction, payload: Record<string, unknown>): string {
  switch (action) {
    case 'member.invited':
      return `${payload.invited_email || '不明'} を${payload.invited_role || 'member'}として招待`;
    case 'member.role_changed':
      return `${payload.old_role || '?'} → ${payload.new_role || '?'}`;
    case 'member.removed':
      return `${payload.target_role || 'member'} を削除`;
    case 'member.deleted':
      return `メンバーを削除（ops操作）`;
    case 'member.updated':
      if (payload.old_role !== payload.new_role) {
        return `${payload.new_email || '?'}: ${payload.old_role} → ${payload.new_role}`;
      }
      return `${payload.new_email || '?'} の情報を更新`;
    case 'org.switched':
      return `組織を切替 (role: ${payload.role || '?'})`;
    case 'organization.created':
      return `組織を作成: ${payload.org_name || '?'}`;
    case 'org.updated':
      return `組織情報を更新（ops操作）`;
    case 'org.deleted':
      return `組織を削除: ${payload.org_name || '?'}`;
    case 'org.ownership_transferred':
      return `オーナー権限を譲渡`;
    case 'org.frozen':
      return `組織を凍結`;
    case 'org.unfrozen':
      return `凍結を解除`;
    case 'org.archived':
      return `組織を廃止`;
    case 'org.suspended':
      return `組織を凍結`;
    case 'payment.updated':
      return `支払い情報を変更`;
    default:
      return JSON.stringify(payload);
  }
}

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; days?: string; name?: string; email?: string }>;
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
  const nameFilter = params.name?.toLowerCase() || '';
  const emailFilter = params.email?.toLowerCase() || '';

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

  // 組織内のユーザー一覧を取得（フィルタ用）
  const { data: profilesData } = await supabase
    .from('profiles')
    .select('user_id')
    .eq('org_id', org.orgId);

  const orgUserIds = profilesData?.map(p => p.user_id) || [];

  // Admin APIでユーザー一覧を取得
  const userMap = new Map<string, UserInfo>();

  const { data: usersData } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (usersData?.users) {
    for (const user of usersData.users) {
      if (orgUserIds.includes(user.id)) {
        userMap.set(user.id, {
          id: user.id,
          email: user.email || '不明',
          name: (user.user_metadata?.name as string) || '',
        });
      }
    }
  }

  // 名前・メールで部分一致フィルタ
  const filteredLogs = activityLogs.filter(log => {
    const user = userMap.get(log.user_id);
    if (!user) return true; // ユーザー情報がない場合は表示

    if (nameFilter && !user.name.toLowerCase().includes(nameFilter)) {
      return false;
    }
    if (emailFilter && !user.email.toLowerCase().includes(emailFilter)) {
      return false;
    }
    return true;
  });

  // CSVデータを生成
  const csvData = filteredLogs.map(log => {
    const user = userMap.get(log.user_id);
    return {
      日時: new Date(log.created_at).toLocaleString('ja-JP'),
      アクション: ACTION_LABELS[log.action] || log.action,
      実行者名: user?.name || '',
      実行者メール: user?.email || '',
      詳細: formatDetails(log.action, log.payload),
      payload: JSON.stringify(log.payload),
    };
  });

  const csvContent = [
    Object.keys(csvData[0] || {}).join(','),
    ...csvData.map(row =>
      Object.values(row).map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
    ),
  ].join('\n');

  const csvDataUri = `data:text/csv;charset=utf-8,${encodeURIComponent(csvContent)}`;

  return (
    <div style={{ padding: '2rem', background: '#1a1a1a', minHeight: '100vh', color: '#e5e5e5' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0 }}>監査ログ</h1>
        {filteredLogs.length > 0 && (
          <a
            href={csvDataUri}
            download={`audit-logs-${new Date().toISOString().split('T')[0]}.csv`}
            style={{
              padding: '0.5rem 1rem',
              background: '#059669',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              textDecoration: 'none',
              fontSize: '0.875rem',
            }}
          >
            CSVダウンロード
          </a>
        )}
      </div>

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
              <option value="org.switched">組織切替</option>
              <option value="member.invited">メンバー招待</option>
              <option value="member.role_changed">ロール変更</option>
              <option value="member.removed">メンバー削除</option>
              <option value="member.updated">メンバー更新</option>
              <option value="member.deleted">メンバー削除（ops）</option>
              <option value="organization.created">組織作成</option>
              <option value="org.updated">組織更新（ops）</option>
              <option value="org.deleted">組織削除（ops）</option>
              <option value="org.ownership_transferred">オーナー権限譲渡</option>
              <option value="org.frozen">組織凍結</option>
              <option value="org.unfrozen">凍結解除</option>
              <option value="org.archived">組織廃止</option>
              <option value="payment.updated">支払い情報変更</option>
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

          <div>
            <label htmlFor="name" style={{ display: 'block', fontSize: '0.875rem', color: '#a1a1aa', marginBottom: '0.5rem' }}>
              実行者名
            </label>
            <input
              id="name"
              name="name"
              type="text"
              defaultValue={params.name || ''}
              placeholder="部分一致"
              style={{
                padding: '0.5rem',
                background: '#1a1a1a',
                color: '#e5e5e5',
                border: '1px solid #404040',
                borderRadius: '4px',
                width: '120px',
              }}
            />
          </div>

          <div>
            <label htmlFor="email" style={{ display: 'block', fontSize: '0.875rem', color: '#a1a1aa', marginBottom: '0.5rem' }}>
              メールアドレス
            </label>
            <input
              id="email"
              name="email"
              type="text"
              defaultValue={params.email || ''}
              placeholder="部分一致"
              style={{
                padding: '0.5rem',
                background: '#1a1a1a',
                color: '#e5e5e5',
                border: '1px solid #404040',
                borderRadius: '4px',
                width: '150px',
              }}
            />
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
                実行者
              </th>
              <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 500, color: '#a1a1aa', textTransform: 'uppercase' }}>
                対象・詳細
              </th>
              <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 500, color: '#a1a1aa', textTransform: 'uppercase' }}>
                JSON
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: '#71717a' }}>
                  監査ログが見つかりませんでした
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => {
                const user = userMap.get(log.user_id);
                return (
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
                    <td style={{ padding: '1rem', fontSize: '0.875rem' }}>
                      {user ? (
                        <div>
                          <div style={{ fontWeight: 500 }}>{user.name || '名前未設定'}</div>
                          <div style={{ fontSize: '0.75rem', color: '#a1a1aa' }}>{user.email}</div>
                        </div>
                      ) : (
                        <span style={{ color: '#71717a', fontFamily: 'monospace' }}>
                          {log.user_id.substring(0, 8)}...
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '1rem', fontSize: '0.875rem' }}>
                      {formatDetails(log.action, log.payload)}
                    </td>
                    <td style={{ padding: '1rem', fontSize: '0.875rem' }}>
                      <details style={{ cursor: 'pointer' }}>
                        <summary style={{ color: '#60a5fa', fontSize: '0.75rem' }}>表示</summary>
                        <pre
                          style={{
                            marginTop: '0.5rem',
                            padding: '0.5rem',
                            background: '#262626',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            overflow: 'auto',
                            color: '#a1a1aa',
                            maxWidth: '300px',
                          }}
                        >
                          {JSON.stringify(log.payload, null, 2)}
                        </pre>
                      </details>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 結果サマリー */}
      <div style={{ marginTop: '1rem', fontSize: '0.875rem', color: '#71717a' }}>
        {filteredLogs.length > 0 && (
          <p>
            {filteredLogs.length} 件のログを表示中（過去{daysFilter}日間
            {actionFilter && actionFilter !== 'all' && `、${ACTION_LABELS[actionFilter]}のみ`}
            {nameFilter && `、名前「${params.name}」`}
            {emailFilter && `、メール「${params.email}」`}
            ）
          </p>
        )}
      </div>
    </div>
  );
}
