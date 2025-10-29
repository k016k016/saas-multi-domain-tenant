import type { Metadata } from 'next';

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
        <nav style={{ padding: '1rem', background: '#312e81', borderBottom: '2px solid #6366f1' }}>
          <strong style={{ color: '#a5b4fc' }}>Ops Domain (事業者専用)</strong>
        </nav>
        {children}
      </body>
    </html>
  );
}
