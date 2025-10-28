import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'SaaS Multi-Tenant Starter',
  description: 'マルチテナント/マルチドメインSaaSスターター',
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
        {children}
      </body>
    </html>
  );
}
