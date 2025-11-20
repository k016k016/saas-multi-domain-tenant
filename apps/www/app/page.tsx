/**
 * www ドメイン: 外向けLP・サインイン導線
 *
 * 責務:
 * - 外向けのランディングページとサインイン導線を提供
 * - 顧客データや内部情報は一切表示しない
 * - ダッシュボード的な機能は置かない
 *
 * 禁止事項:
 * - 組織データ・ユーザーデータの表示
 * - 業務機能の配置
 */

import { cookies } from 'next/headers';

export default async function HomePage() {
  // セッションCookieの存在確認
  const cookieStore = await cookies();
  const hasSession = cookieStore.getAll().some(
    cookie => cookie.name.startsWith('sb-') && cookie.name.includes('auth-token')
  );

  // ログイン状態ならappへ、未ログインならログインページへ
  const signInHref = hasSession
    ? process.env.NEXT_PUBLIC_APP_URL || 'http://app.local.test:3002'
    : '/login';
  return (
    <div
      style={{
        minHeight: '100vh',
        padding: '2rem',
        maxWidth: '800px',
        margin: '0 auto',
        backgroundColor: '#f9fafb',
        color: '#111827',
      }}
    >
      <h1>SaaS Multi-Tenant Starter</h1>
      <p>
        マルチテナント / マルチドメイン構成のSaaSスターターへようこそ。
      </p>

      <section style={{ marginTop: '2rem' }}>
        <h2>4つのドメイン</h2>
        <ul>
          <li><strong>www</strong>: 外向けLP・サインイン導線（このページ）</li>
          <li><strong>app</strong>: 日常業務UI（全ロール対象）</li>
          <li><strong>admin</strong>: 組織管理・請求（admin/owner専用）</li>
          <li><strong>ops</strong>: 事業者側コンソール</li>
        </ul>
      </section>

      <section style={{ marginTop: '2rem' }}>
        <h2>サインイン / サインアウト</h2>
        <p>
          メールアドレスでサインインできます。
          Magic Link（ワンタイムサインインリンク）を送信します。サインイン後は、アプリ内のメニューからサインアウトできます。
        </p>
        <div style={{ marginTop: '1rem' }}>
          <a
            href={signInHref}
            style={{
              display: 'inline-block',
              padding: '0.5rem 1rem',
              background: '#0070f3',
              color: 'white',
              borderRadius: '4px',
              textDecoration: 'none',
            }}
          >
            サインイン
          </a>
        </div>
      </section>

      <section
        style={{
          marginTop: '2rem',
          padding: '1rem',
          fontSize: '0.875rem',
          backgroundColor: '#e5e7eb',
          borderRadius: '0.5rem',
          color: '#374151',
        }}
      >
        <p>
          注: このプロジェクトは責務分離とセキュリティを重視しています。
          各ドメインは明確に分離されており、統合は禁止されています。
        </p>
      </section>
    </div>
  );
}
