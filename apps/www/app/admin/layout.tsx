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
        background: '#fef3c7',
        borderBottom: '1px solid #f59e0b',
        display: 'flex',
        alignItems: 'center',
        gap: '2rem'
      }}>
        <strong style={{ color: '#f59e0b' }}>Admin Domain (組織管理)</strong>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <a href="/" style={{ color: '#f59e0b', textDecoration: 'none' }}>組織概要</a>
          <a href="/members" style={{ color: '#f59e0b', textDecoration: 'none' }}>メンバー管理</a>
          <a href="/org-settings" style={{ color: '#f59e0b', textDecoration: 'none' }}>組織設定</a>
        </div>
      </nav>
      {children}
    </>
  );
}
