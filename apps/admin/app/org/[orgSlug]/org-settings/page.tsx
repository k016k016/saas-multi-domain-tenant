/**
 * admin ドメイン: /o/[orgSlug]/org-settings
 *
 * Phase 3: URL で org を指定（動的ルート版）
 */

import { getCurrentOrg } from '@repo/config';
import { getSupabaseAdmin, createServerClient } from '@repo/db';
import { notFound, redirect } from 'next/navigation';

// cookies()を使用するため、動的レンダリングを強制
export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{
    orgSlug: string;
  }>;
}

export default async function OrgSettingsPageWithOrgSlug({ params }: PageProps) {
  // Next.js 15以降、paramsはPromiseとして渡される
  const { orgSlug } = await params;

  // orgSlugを指定してgetCurrentOrgを呼び出す
  const org = await getCurrentOrg({ orgSlug });

  if (!org) {
    notFound();
  }

  // この組織でのユーザーのロールを取得
  const supabase = await createServerClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.user) {
    redirect('/unauthorized');
  }

  const adminSupabase = getSupabaseAdmin();
  const { data: profile } = await adminSupabase
    .from('profiles')
    .select('role')
    .eq('user_id', session.user.id)
    .eq('org_id', org.orgId)
    .single();

  const currentUserRole = profile?.role as 'owner' | 'admin' | 'member' | undefined;

  // ADMIN domain: owner のみアクセス可能
  if (!currentUserRole || currentUserRole !== 'owner') {
    redirect('/unauthorized');
  }

  // 組織の詳細情報を取得
  const { data: orgData, error } = await adminSupabase
    .from('organizations')
    .select('id, name, created_at, slug')
    .eq('id', org.orgId)
    .single();

  if (error || !orgData) {
    notFound();
  }

  // member数を取得
  const { count: memberCount } = await adminSupabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', org.orgId);

  const organization = {
    id: orgData.id,
    name: orgData.name,
    slug: orgData.slug,
    memberCount: memberCount || 0,
    createdAt: new Date(orgData.created_at).toLocaleDateString('ja-JP'),
  };

  // 組織設定ページを表示（シンプルな実装）
  return (
    <div style={{ padding: '2rem' }}>
      <h1>組織設定</h1>

      <section style={{ marginTop: '2rem' }}>
        <h2>{org.orgName}</h2>
        <dl style={{ lineHeight: '1.8' }}>
          <dt><strong>組織ID:</strong></dt>
          <dd><code>{organization.id}</code></dd>
          <dt><strong>Slug:</strong></dt>
          <dd><code>{organization.slug}</code></dd>
          <dt><strong>メンバー数:</strong></dt>
          <dd>{organization.memberCount}人</dd>
          <dt><strong>作成日:</strong></dt>
          <dd>{organization.createdAt}</dd>
        </dl>
      </section>

      <section style={{ marginTop: '2rem', padding: '1rem', background: '#fee2e2', borderRadius: '4px' }}>
        <h3>権限について</h3>
        <p>このページは owner 権限を持つユーザーのみアクセスできます。</p>
        <p>あなたのロール: <strong>{currentUserRole}</strong></p>
      </section>
    </div>
  );
}