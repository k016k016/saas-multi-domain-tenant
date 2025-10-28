import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Admin - SaaS Multi-Tenant',
  description: '組織管理ダッシュボード',
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <nav style={{
        padding: '1rem',
        background: '#78350f',
        borderBottom: '2px solid #f59e0b',
        display: 'flex',
        alignItems: 'center',
        gap: '2rem'
      }}>
        <strong style={{ color: '#fbbf24' }}>Admin Domain (組織管理)</strong>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <a href="/" style={{ color: '#fcd34d', textDecoration: 'none' }}>組織概要</a>
          <a href="/members" style={{ color: '#fcd34d', textDecoration: 'none' }}>メンバー管理</a>
          <a href="/org-settings" style={{ color: '#fcd34d', textDecoration: 'none' }}>組織設定</a>
        </div>
      </nav>
      {children}
    </>
  );
}
