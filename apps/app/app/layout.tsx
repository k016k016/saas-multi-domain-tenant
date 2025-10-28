import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'App - SaaS Multi-Tenant',
  description: '日常業務UI',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>
        <nav style={{ padding: '1rem', background: '#f5f5f5', borderBottom: '1px solid #ddd' }}>
          <strong>App Domain</strong> |
          <a href="/dashboard" style={{ marginLeft: '1rem' }}>ダッシュボード</a> |
          <a href="/switch-org" style={{ marginLeft: '1rem' }}>組織切替</a>
        </nav>
        {children}
      </body>
    </html>
  );
}
