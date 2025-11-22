/**
 * admin ドメイン: /org-settings
 *
 * 責務:
 * - owner専用の組織設定UI
 * - 支払い情報の変更
 * - 組織の凍結 / 廃止（状態遷移）
 * - admin権限の付け替え
 * - owner権限の譲渡
 *
 * アクセス制御:
 * - owner のみアクセス可能
 * - admin は 403 を返す想定（middlewareで制御）
 *
 * 監査ログ:
 * - これらすべての操作は activity_logs に必ず記録する
 * - action: 'payment_updated' / 'org_suspended' / 'org_closed' / 'owner_transferred' 等
 *
 * 禁止事項:
 * - これらの機能を app ドメインに配置することは絶対に禁止
 */

import { getCurrentOrg, getCurrentRole } from '@repo/config';
import { createServerClient, getSupabaseAdmin } from '@repo/db';
import { redirect } from 'next/navigation';
import OrgSettingsClient from './org-settings-client';

// cookies()を使用するため、動的レンダリングを強制
export const dynamic = 'force-dynamic';

export default async function OrgSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const { org: orgSlug } = await searchParams;
  const org = await getCurrentOrg(orgSlug ? { orgSlug } : undefined);
  const roleContext = await getCurrentRole();
  const role = roleContext?.role;

  // ADMIN domain: owner のみアクセス可能
  if (!role || role !== 'owner') {
    redirect('/unauthorized');
  }

  if (!org) {
    redirect('/unauthorized');
  }

  const supabase = await createServerClient();
  const supabaseAdmin = getSupabaseAdmin();

  // 組織のメンバー一覧を取得（owner譲渡の選択肢用）
  const { data: profilesData, error: profilesError } = await supabaseAdmin
    .from('profiles')
    .select('user_id, role')
    .eq('org_id', org.orgId)
    .order('role');

  if (profilesError) {
    console.error('[OrgSettingsPage] Failed to fetch profiles:', profilesError);
    return <div>メンバー一覧の取得に失敗しました</div>;
  }

  // auth.usersテーブルからメールアドレスと氏名を取得
  const { data: usersData, error: usersError } = await supabaseAdmin.auth.admin.listUsers();

  if (usersError) {
    console.error('[OrgSettingsPage] Failed to fetch users:', usersError);
    return <div>ユーザー情報の取得に失敗しました</div>;
  }

  // user_idをキーにしたマップを作成
  const userMap = new Map<string, { email: string; name: string }>();
  usersData?.users?.forEach((user) => {
    userMap.set(user.id, {
      email: user.email || '',
      name: user.user_metadata?.name || '',
    });
  });

  // profilesとusersをマージしてメンバー一覧を作成
  const members =
    profilesData?.map((profile) => {
      const userInfo = userMap.get(profile.user_id);
      return {
        userId: profile.user_id,
        email: userInfo?.email || `${profile.user_id.substring(0, 8)}@...`,
        name: userInfo?.name || '',
        role: profile.role as 'owner' | 'admin' | 'member',
      };
    }) || [];

  // 組織のアクティブ状態を取得（凍結/解除の判定用）
  const { data: orgData, error: orgError } = await supabase
    .from('organizations')
    .select('is_active')
    .eq('id', org.orgId)
    .single();

  if (orgError) {
    console.error('[OrgSettingsPage] Failed to fetch org status:', orgError);
    return <div>組織情報の取得に失敗しました</div>;
  }

  return (
    <div style={{ padding: '2rem', background: '#1a1a1a', minHeight: '100vh', color: '#e5e5e5' }}>
      <h1 style={{ marginBottom: '1.5rem' }}>組織設定 (Owner専用)</h1>

      <section style={{ marginTop: '2rem' }}>
        <h2>現在のコンテキスト</h2>
        <p>組織: <strong>{org.orgName}</strong></p>
        <p>あなたのロール: <strong>{role}</strong></p>
        <p>組織状態: <strong>{orgData.is_active ? 'アクティブ' : '凍結中'}</strong></p>
      </section>

      <OrgSettingsClient
        orgName={org.orgName}
        members={members ?? []}
        isActive={orgData.is_active}
      />

      <section style={{ marginTop: '2rem', padding: '1rem', background: '#422006', border: '1px solid #92400e', borderRadius: '4px' }}>
        <h3 style={{ margin: 0, color: '#fbbf24' }}>重要な注意事項</h3>
        <ul style={{ fontSize: '0.875rem', marginTop: '0.5rem', color: '#fde68a' }}>
          <li>これらの操作はすべて activity_logs に記録されます</li>
          <li>ownerは各組織に必ず1人で、削除不可です</li>
          <li>owner交代は「譲渡」のみで可能（新オーナー指名→元オーナー降格）</li>
          <li><strong>これらの機能を app ドメインに配置することは絶対に禁止されています</strong></li>
        </ul>
      </section>
    </div>
  );
}
