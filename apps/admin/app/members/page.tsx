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
 * - adminとownerのみアクセス可能（ページレベルでチェック）
 * - ownerのロール変更・削除は禁止（Server Actionで制御）
 */

import { getCurrentOrg, getCurrentRole } from '@repo/config';
import { createServerClient } from '@repo/db';
import { notFound, redirect } from 'next/navigation';
import InviteUserForm from './invite-user-form';
import MemberList from './member-list';

// cookies()を使用するため、動的レンダリングを強制
export const dynamic = 'force-dynamic';

export default async function MembersPage() {
  const org = await getCurrentOrg();
  const roleContext = await getCurrentRole();
  const currentUserRole = roleContext?.role;

  // DEBUG: ロール情報をログ出力
  console.log('[MembersPage] org:', org);
  console.log('[MembersPage] roleContext:', roleContext);
  console.log('[MembersPage] currentUserRole:', currentUserRole);

  // ADMIN domain: admin/owner のみアクセス可能
  if (!currentUserRole || (currentUserRole !== 'admin' && currentUserRole !== 'owner')) {
    console.log('[MembersPage] Access denied - redirecting to /unauthorized');
    redirect('/unauthorized');
  }

  if (!org) {
    notFound();
  }

  // Supabase profilesテーブルから組織のメンバー一覧を取得
  const supabase = await createServerClient();
  const { data: profilesData, error: profilesError } = await supabase
    .from('profiles')
    .select('user_id, role, created_at')
    .eq('org_id', org.orgId)
    .order('created_at', { ascending: false });

  if (profilesError) {
    console.error('[MembersPage] Failed to fetch profiles:', profilesError);
  }

  // auth.usersテーブルからメールアドレスを取得（Service Role Key必要）
  // 注: 現在はメールアドレス取得が難しいため、user_idのみ表示
  // 将来的にはSupabase Admin APIまたはAuth Adminを使用してメールを取得
  const members =
    profilesData?.map((profile) => ({
      userId: profile.user_id,
      email: `${profile.user_id.substring(0, 8)}@...`, // 暫定: user_idの一部を表示
      role: profile.role as 'owner' | 'admin' | 'member',
      status: 'active' as const, // 現在のスキーマにはstatusカラムがないため固定
      createdAt: new Date(profile.created_at).toLocaleDateString('ja-JP'),
    })) || [];

  return (
    <div style={{ padding: '2rem' }}>
      <header style={{ marginBottom: '2rem' }}>
        <h1>Members / メンバー管理</h1>
        <p style={{ color: '#a1a1aa', marginTop: '0.5rem' }}>
          組織: <strong>{org?.orgName ?? 'unknown'}</strong> ({org?.orgId ?? 'unknown'})
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
        {currentUserRole && <MemberList members={members} currentUserRole={currentUserRole} />}
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
