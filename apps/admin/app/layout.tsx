/**
 * admin ドメイン レイアウト
 *
 * アクセス制御:
 * - admin と owner のみアクセス可能
 * - member は 403 を返す
 * - middlewareでロール検証済みであることを前提とする
 */

import type { Metadata } from 'next';
import SignOutButton from './signout-button';

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
          <SignOutButton />
        </nav>
        {children}
      </body>
    </html>
  );
}
