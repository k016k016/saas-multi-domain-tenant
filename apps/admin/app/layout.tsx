/**
 * admin ドメイン レイアウト
 *
 * アクセス制御:
 * - admin と owner のみアクセス可能
 * - member は 403 を返す
 * - 未所属orgへのアクセスは各ページで検証（layoutでは通す）
 */

import type { Metadata } from 'next';
import SignOutButton from './signout-button';
import OrgSwitcher from '../../app/app/org-switcher';
import { getCurrentOrg, getUserOrganizations } from '@repo/config';

export const metadata: Metadata = {
  title: 'Admin - SaaS Multi-Tenant',
  description: '組織管理・請求UI (admin/owner専用)',
};

// 親レイアウトで getCurrentOrg()（= cookies()）を使用するため、
// admin 配下のルートはすべて dynamic として扱う（SSR専用）。
export const dynamic = 'force-dynamic';

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const org = await getCurrentOrg();
  const availableOrgs = await getUserOrganizations();

  // orgがnullの場合は各ページで権限検証・リダイレクト処理を行う
  // layoutではナビゲーションを表示しないだけ
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
          background: '#78350f',
          borderBottom: '2px solid #f59e0b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
            <strong style={{ color: '#fbbf24' }}>Admin Domain (組織管理)</strong>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <a href="/" style={{ color: '#fcd34d', textDecoration: 'none' }}>ダッシュボード</a>
              <a href="/members" style={{ color: '#fcd34d', textDecoration: 'none' }}>メンバー管理</a>
              <a href="/audit-logs" style={{ color: '#fcd34d', textDecoration: 'none' }}>監査ログ</a>
              <a href="/org-settings" style={{ color: '#fcd34d', textDecoration: 'none' }}>組織設定</a>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {org && availableOrgs.length > 0 && (
              <OrgSwitcher
                currentOrg={{ id: org.orgId, name: org.orgName, slug: availableOrgs.find(o => o.id === org.orgId)?.slug || '' }}
                availableOrgs={availableOrgs}
              />
            )}
            <SignOutButton />
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
