/**
 * admin ドメイン レイアウト
 *
 * アクセス制御:
 * - admin と owner のみアクセス可能
 * - member は 403 を返す
 * - middlewareでロール検証済みであることを前提とする
 */

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Admin - SaaS Multi-Tenant',
  description: '組織管理・請求UI (admin/owner専用)',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>
        <nav style={{ padding: '1rem', background: '#fee2e2', borderBottom: '1px solid #dc2626' }}>
          <strong style={{ color: '#dc2626' }}>Admin Domain (admin/owner専用)</strong> |
          <a href="/overview" style={{ marginLeft: '1rem' }}>概要</a> |
          <a href="/members" style={{ marginLeft: '1rem' }}>ユーザー管理</a> |
          <a href="/org-settings" style={{ marginLeft: '1rem' }}>組織設定 (owner専用)</a>
        </nav>
        {children}
      </body>
    </html>
  );
}
