/**
 * www ドメイン: 外向けLP・ログイン導線
 *
 * 責務:
 * - 外向けのランディングページとログイン導線を提供
 * - 顧客データや内部情報は一切表示しない
 * - ダッシュボード的な機能は置かない
 *
 * 禁止事項:
 * - 組織データ・ユーザーデータの表示
 * - 業務機能の配置
 */

export default function HomePage() {
  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1>SaaS Multi-Tenant Starter</h1>
      <p>
        マルチテナント / マルチドメイン構成のSaaSスターターへようこそ。
      </p>

      <section style={{ marginTop: '2rem' }}>
        <h2>4つのドメイン</h2>
        <ul>
          <li><strong>www</strong>: 外向けLP・ログイン導線（このページ）</li>
          <li><strong>app</strong>: 日常業務UI（全ロール対象）</li>
          <li><strong>admin</strong>: 組織管理・請求（admin/owner専用）</li>
          <li><strong>ops</strong>: 事業者側コンソール</li>
        </ul>
      </section>

      <section style={{ marginTop: '2rem' }}>
        <h2>ログイン</h2>
        <p>
          {/* TODO: 実際のログインフローは未実装 */}
          ログイン機能は現在未実装です。
          開発環境では各ドメインに直接アクセスできます。
        </p>
        <div style={{ marginTop: '1rem' }}>
          <a
            href={process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'}
            style={{
              display: 'inline-block',
              padding: '0.5rem 1rem',
              background: '#0070f3',
              color: 'white',
              borderRadius: '4px',
              textDecoration: 'none',
            }}
          >
            アプリへ移動（ダミー）
          </a>
        </div>
      </section>

      <section style={{ marginTop: '2rem', fontSize: '0.875rem', color: '#666' }}>
        <p>
          注: このプロジェクトは責務分離とセキュリティを重視しています。
          各ドメインは明確に分離されており、統合は禁止されています。
        </p>
      </section>
    </div>
  );
}
