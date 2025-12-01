import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import LogoutButton from './logout-button';
import OrgSwitcher from './org-switcher';
import { getCurrentOrg, getUserOrganizations } from '@repo/config';

export const metadata: Metadata = {
  title: 'App - SaaS Multi-Tenant',
  description: '日常業務ダッシュボード',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const org = await getCurrentOrg();
  const availableOrgs = await getUserOrganizations();

  // X-Org-Slugヘッダーがある場合（ホストベースでorg指定）かつorgがnull → 未所属orgへのアクセス
  // ヘッダーなしでorgがnullの場合はログインページへリダイレクトされている前提
  const headersList = await headers();
  const hasOrgSlugHeader = headersList.has('x-org-slug');

  if (!org && hasOrgSlugHeader) {
    // 明示的なorg指定があるのに所属していない → 404
    notFound();
  }
  return (
    <html lang="ja">
      <body style={{
        margin: 0,
        padding: 0,
        background: '#1a1a1a',
        color: '#e5e5e5',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        minHeight: '100vh'
      }}>
        <nav style={{
          padding: '1rem',
          background: '#1e3a5f',
          borderBottom: '2px solid #3b82f6',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
            <strong style={{ color: '#60a5fa' }}>App Domain (業務アプリ)</strong>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <a href="/" style={{ color: '#93c5fd', textDecoration: 'none' }}>ダッシュボード</a>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {org && availableOrgs.length > 0 && (
              <OrgSwitcher
                currentOrg={{ id: org.orgId, name: org.orgName, slug: availableOrgs.find(o => o.id === org.orgId)?.slug || '' }}
                availableOrgs={availableOrgs}
              />
            )}
            <a href="/profile" style={{ color: '#93c5fd', textDecoration: 'none' }}>プロフィール</a>
            <LogoutButton />
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
