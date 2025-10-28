import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Ops - SaaS Multi-Tenant',
  description: '事業者側コンソール (ops専用)',
};

export default function OpsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <nav style={{ padding: '1rem', background: '#312e81', borderBottom: '2px solid #6366f1' }}>
        <strong style={{ color: '#a5b4fc' }}>Ops Domain (事業者専用)</strong>
      </nav>
      {children}
    </>
  );
}
