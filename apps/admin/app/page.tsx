/**
 * 管理画面トップページ
 *
 * 責務:
 * - admin/owner専用のダッシュボード
 * - 各管理機能へのナビゲーション
 */

import Link from 'next/link';

export default function AdminHomePage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        padding: '2rem',
        maxWidth: '800px',
        margin: '0 auto',
        backgroundColor: '#111827',
        color: '#f9fafb',
      }}
    >
      <h1 style={{ marginBottom: '1.5rem' }}>管理画面</h1>
      <p style={{ marginBottom: '2rem', color: '#9ca3af' }}>
        組織の管理機能にアクセスできます。
      </p>

      <nav>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          <li style={{ marginBottom: '1rem' }}>
            <Link
              href="/members"
              style={{
                display: 'block',
                padding: '1rem',
                background: '#1f2937',
                borderRadius: '8px',
                textDecoration: 'none',
                color: '#60a5fa',
                boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
              }}
            >
              <strong>メンバー管理</strong>
              <p style={{ margin: '0.5rem 0 0', fontSize: '0.875rem', color: '#9ca3af' }}>
                メンバーの招待・ロール変更・削除
              </p>
            </Link>
          </li>
          <li style={{ marginBottom: '1rem' }}>
            <Link
              href="/audit-logs"
              style={{
                display: 'block',
                padding: '1rem',
                background: '#1f2937',
                borderRadius: '8px',
                textDecoration: 'none',
                color: '#60a5fa',
                boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
              }}
            >
              <strong>監査ログ</strong>
              <p style={{ margin: '0.5rem 0 0', fontSize: '0.875rem', color: '#9ca3af' }}>
                組織内の操作履歴を確認
              </p>
            </Link>
          </li>
        </ul>
      </nav>
    </div>
  );
}
