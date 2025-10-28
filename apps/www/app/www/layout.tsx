import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'SaaS Multi-Tenant Starter - Welcome',
  description: 'マルチテナント/マルチドメインSaaSスターター',
};

export default function WwwLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <nav style={{
        padding: '1rem',
        background: '#2d2d2d',
        borderBottom: '1px solid #404040',
        display: 'flex',
        alignItems: 'center',
        gap: '2rem'
      }}>
        <strong style={{ color: '#9ca3af' }}>WWW (公開サイト)</strong>
      </nav>
      {children}
    </>
  );
}
