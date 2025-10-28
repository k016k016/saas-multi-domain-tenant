import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'SaaS Multi-Tenant Starter - Welcome',
  description: 'マルチテナント/マルチドメインSaaSスターター',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
