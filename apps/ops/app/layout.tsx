import type { Metadata } from 'next';
import { OpsNav } from './ops-nav';

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
        <OpsNav />
        {children}
      </body>
    </html>
  );
}
