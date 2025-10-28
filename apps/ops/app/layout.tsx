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
      <body>
        <nav style={{ padding: '1rem', background: '#e0e7ff', borderBottom: '1px solid #6366f1' }}>
          <strong style={{ color: '#6366f1' }}>Ops Domain (事業者専用)</strong>
        </nav>
        {children}
      </body>
    </html>
  );
}
