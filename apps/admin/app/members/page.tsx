/**
 * admin ドメイン: /members
 *
 * 責務:
 * - 組織内のメンバー一覧を表示
 * - 新規ユーザーの招待
 * - メンバーのロール変更
 * - メンバーの削除/無効化
 *
 * 権限:
 * - adminとownerのみアクセス可能（middlewareで制御済み）
 * - ownerのロール変更・削除は禁止（Server Actionで制御）
 */

import { getCurrentOrg, getCurrentRole } from '@repo/config';
import InviteUserForm from './invite-user-form';
import MemberList from './member-list';

export default async function MembersPage() {
  const org = await getCurrentOrg();
  const { role: currentUserRole } = await getCurrentRole();

  // TODO: 実際にはSupabase profilesテーブルから組織のメンバー一覧を取得
  // SELECT user_id, email, role, status, created_at, invited_by
  // FROM profiles
  // WHERE org_id = $1
  // ORDER BY created_at DESC
  const members = [
    {
      userId: 'user_owner_123',
      email: 'owner@example.com',
      role: 'owner' as const,
      status: 'active' as const,
      createdAt: '2025-01-01',
    },
    {
      userId: 'user_admin_456',
      email: 'admin@example.com',
      role: 'admin' as const,
      status: 'active' as const,
      createdAt: '2025-01-10',
    },
    {
      userId: 'user_member_789',
      email: 'member@example.com',
      role: 'member' as const,
      status: 'active' as const,
      createdAt: '2025-01-15',
    },
    {
      userId: 'user_pending_abc',
      email: 'pending@example.com',
      role: 'member' as const,
      status: 'pending' as const,
      createdAt: '2025-01-20',
    },
  ];

  return (
    <div style={{ padding: '2rem' }}>
      <header style={{ marginBottom: '2rem' }}>
        <h1>メンバー管理</h1>
        <p style={{ color: '#a1a1aa', marginTop: '0.5rem' }}>
          組織: <strong>{org.orgName}</strong> ({org.orgId})
        </p>
        <p style={{ color: '#a1a1aa', fontSize: '0.875rem' }}>
          現在のメンバー数: {members.filter((m) => m.status === 'active').length}人
        </p>
      </header>

      {/* 新規ユーザー招待セクション */}
      <section
        style={{
          marginBottom: '2rem',
          padding: '1.5rem',
          background: '#262626',
          border: '1px solid #404040',
          borderRadius: '8px',
        }}
      >
        <h2 style={{ marginTop: 0, marginBottom: '1rem' }}>
          新規ユーザーを招待
        </h2>
        <InviteUserForm />
      </section>

      {/* メンバー一覧セクション */}
      <section>
        <h2 style={{ marginBottom: '1rem' }}>メンバー一覧</h2>
        <MemberList members={members} currentUserRole={currentUserRole} />
      </section>

      {/* 注意書き */}
      <section
        style={{
          marginTop: '2rem',
          padding: '1rem',
          background: '#422006',
          border: '1px solid #92400e',
          borderRadius: '4px',
        }}
      >
        <h3 style={{ margin: 0, color: '#fbbf24' }}>注意</h3>
        <ul
          style={{
            marginTop: '0.5rem',
            fontSize: '0.875rem',
            color: '#fde68a',
          }}
        >
          <li>ownerのロール変更・削除はできません</li>
          <li>adminは複数人設定可能です</li>
          <li>すべての操作はactivity_logsに記録されます（将来実装）</li>
        </ul>
      </section>
    </div>
  );
}
