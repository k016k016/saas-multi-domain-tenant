/**
 * app ドメイン: /unauthorized
 *
 * 責務:
 * - アクセス権限がないユーザーに403エラーページを表示
 * - ホームへの戻るリンクを提供
 *
 * 注意:
 * - 親レイアウトで getCurrentOrg()（= cookies()）を使用しているため、
 *   このページは dynamic として扱う（SSR専用）。表示内容は静的であり、
 *   セッション情報や機密データは含めない。
 */

// 親レイアウトが cookies() を使うため、このルートを動的扱いにしてビルドエラーを防ぐ
export const dynamic = 'force-dynamic';

import Link from 'next/link';

export default function UnauthorizedPage() {
  return (
    <div style={{ padding: '2rem', textAlign: 'center', maxWidth: '600px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '3rem', marginBottom: '1rem' }}>403</h1>
      <h2 style={{ marginBottom: '1rem' }}>アクセス権限がありません</h2>
      <p style={{ marginBottom: '2rem', color: '#a0a0a0' }}>
        このページにアクセスする権限がありません。<br />
        必要な権限については、組織の管理者にお問い合わせください。
      </p>
      <Link
        href="/"
        style={{
          display: 'inline-block',
          padding: '0.75rem 1.5rem',
          background: '#3b82f6',
          color: 'white',
          textDecoration: 'none',
          borderRadius: '4px',
        }}
      >
        ホームに戻る
      </Link>
    </div>
  );
}
