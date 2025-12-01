/**
 * パスワードリセットページ
 *
 * 責務:
 * - 新パスワード入力フォームの表示
 *
 * 注意:
 * - このページは /auth/callback?type=recovery からリダイレクトされる
 * - recovery token によりセッションが自動的に作成されている状態
 */

import { ResetPasswordForm } from './reset-password-form';

export default function ResetPasswordPage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f3f4f6',
        padding: '1rem',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '400px',
          background: 'white',
          padding: '2rem',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}
      >
        <h1
          style={{
            fontSize: '1.5rem',
            fontWeight: '600',
            textAlign: 'center',
            marginBottom: '1.5rem',
            color: '#111827',
          }}
        >
          新しいパスワードを設定
        </h1>
        <p
          style={{
            fontSize: '0.875rem',
            color: '#6b7280',
            textAlign: 'center',
            marginBottom: '1.5rem',
          }}
        >
          新しいパスワードを入力してください。
        </p>
        <ResetPasswordForm />
      </div>
    </main>
  );
}
