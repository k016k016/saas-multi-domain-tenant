/**
 * admin ドメイン: /o/[orgSlug]/audit-logs
 *
 * Phase 3: URL で org を指定（動的ルート版）
 */

import { getCurrentOrg, getCurrentRole } from '@repo/config';
import { getSupabaseAdmin } from '@repo/db';
import { notFound, redirect } from 'next/navigation';

// cookies()を使用するため、動的レンダリングを強制
export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{
    orgSlug: string;
  }>;
}

export default async function AuditLogsPageWithOrgSlug({ params }: PageProps) {
  // Next.js 15以降、paramsはPromiseとして渡される
  const { orgSlug } = await params;

  // orgSlugを指定してgetCurrentOrgを呼び出す
  const org = await getCurrentOrg({ orgSlug });
  const roleContext = await getCurrentRole();
  const currentUserRole = roleContext?.role;

  // ADMIN domain: admin/owner のみアクセス可能
  if (!currentUserRole || (currentUserRole !== 'admin' && currentUserRole !== 'owner')) {
    redirect('/unauthorized');
  }

  if (!org) {
    notFound();
  }

  // 監査ログを取得（最新100件）
  const adminSupabase = getSupabaseAdmin();
  const { data: activityLogs, error } = await adminSupabase
    .from('activity_logs')
    .select('id, user_id, action, payload, created_at')
    .eq('org_id', org.orgId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error('[AuditLogsPageWithOrgSlug] Failed to fetch activity logs:', error);
  }

  // ユーザー情報を取得して結合
  const { data: usersData } = await adminSupabase.auth.admin.listUsers();
  const userMap = new Map<string, string>();
  usersData?.users?.forEach((user) => {
    userMap.set(user.id, user.email || user.user_metadata?.name || user.id);
  });

  const logs = (activityLogs || []).map((log) => ({
    id: log.id,
    userId: log.user_id || 'system',
    userEmail: userMap.get(log.user_id || '') || log.user_id || 'システム',
    action: log.action,
    payload: log.payload,
    createdAt: new Date(log.created_at).toLocaleString('ja-JP'),
  }));

  // 監査ログページを表示（シンプルな実装）
  return (
    <div style={{ padding: '2rem' }}>
      <h1>監査ログ</h1>
      <h2>{org.orgName}</h2>

      <section style={{ marginTop: '2rem' }}>
        <p>最新{logs.length}件の監査ログを表示しています。</p>

        <table style={{ width: '100%', marginTop: '1rem', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
              <th style={{ textAlign: 'left', padding: '0.5rem' }}>日時</th>
              <th style={{ textAlign: 'left', padding: '0.5rem' }}>ユーザー</th>
              <th style={{ textAlign: 'left', padding: '0.5rem' }}>アクション</th>
            </tr>
          </thead>
          <tbody>
            {logs.slice(0, 10).map((log) => (
              <tr key={log.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                <td style={{ padding: '0.5rem' }}>{log.createdAt}</td>
                <td style={{ padding: '0.5rem' }}>{log.userEmail}</td>
                <td style={{ padding: '0.5rem' }}>{log.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}