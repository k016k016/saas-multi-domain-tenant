/**
 * OPS専用 サインインページ (パスワード認証)
 *
 * 責務:
 * - OPS管理者用のメールアドレス・パスワード入力フォーム
 * - Supabase パスワード認証
 * - 認証済みユーザーは OPS ドメインへリダイレクト
 *
 * 重要:
 * - このページのURLは非公開（知っている人のみアクセス）
 * - 未認証でOPSドメインにアクセスした場合はwww/loginへリダイレクトされる
 * - こちらは直接アクセスする隠れたエントリーポイント
 */

import { LoginForm } from './login-form';

export default function OpsLoginPage() {
  return (
    <div
      data-testid="ops-login-page-ready"
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#1e1b4b',
      }}
    >
      <div style={{
        width: '100%',
        maxWidth: '400px',
        padding: '2rem',
        background: 'white',
        borderRadius: '8px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#6366f1', marginBottom: '0.5rem' }}>
            OPS管理コンソール
          </h1>
          <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>
            管理者専用サインイン
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
