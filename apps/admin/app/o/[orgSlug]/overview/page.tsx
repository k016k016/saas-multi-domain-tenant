/**
 * admin ドメイン: /o/[orgSlug]/overview
 *
 * Phase 3: URL で org を指定（動的ルート版）
 */

import { getCurrentOrg, getCurrentRole } from '@repo/config';
import { notFound, redirect } from 'next/navigation';

// cookies()を使用するため、動的レンダリングを強制
export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{
    orgSlug: string;
  }>;
}

export default async function OverviewPageWithOrgSlug({ params }: PageProps) {
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

  // 組織情報を表示（シンプルな実装）
  return (
    <div style={{ padding: '2rem' }}>
      <h1>組織概要</h1>

      <section style={{ marginTop: '2rem' }}>
        <h2>現在のコンテキスト</h2>
        <p>組織名: <strong>{org.orgName}</strong></p>
        <p>組織ID: <code>{org.orgId}</code></p>
        <p>あなたのロール: <strong>{currentUserRole}</strong></p>
      </section>

      <section style={{ marginTop: '2rem', padding: '1rem', background: '#f3f4f6', borderRadius: '4px' }}>
        <h3>URLベース組織指定について</h3>
        <p>このページは /o/{orgSlug}/overview のURLパターンで動的に組織を解決しています。</p>
      </section>
    </div>
  );
}