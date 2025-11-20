import type { Metadata } from 'next';
import SignOutButton from './signout-button';

export const metadata: Metadata = {
  title: 'Ops - SaaS Multi-Tenant',
  description: '事業者側コンソール (ops専用)',
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
          background: '#312e81',
          borderBottom: '2px solid #6366f1',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
            <strong style={{ color: '#a5b4fc' }}>Ops Domain (事業者専用)</strong>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <a href="/" style={{ color: '#c7d2fe', textDecoration: 'none' }}>ダッシュボード</a>
              <a href="/orgs" style={{ color: '#c7d2fe', textDecoration: 'none' }}>組織一覧</a>
              <a href="/orgs/new" style={{ color: '#c7d2fe', textDecoration: 'none' }}>新規組織作成</a>
            </div>
          </div>
          <SignOutButton />
        </nav>
        {children}
      </body>
    </html>
  );
}
