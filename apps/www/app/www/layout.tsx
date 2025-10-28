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
        background: '#f3f4f6',
        borderBottom: '1px solid #d1d5db',
        display: 'flex',
        alignItems: 'center',
        gap: '2rem'
      }}>
        <strong style={{ color: '#374151' }}>WWW (公開サイト)</strong>
      </nav>
      {children}
    </>
  );
}
