/**
 * パスワードリセットリクエストページ
 *
 * 責務:
 * - パスワードリセット用メールアドレス入力フォームの表示
 */

import { ForgotPasswordForm } from './forgot-password-form';

export default function ForgotPasswordPage() {
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
          パスワードをリセット
        </h1>
        <p
          style={{
            fontSize: '0.875rem',
            color: '#6b7280',
            textAlign: 'center',
            marginBottom: '1.5rem',
          }}
        >
          登録されているメールアドレスを入力してください。
          パスワードリセット用のリンクをお送りします。
        </p>
        <ForgotPasswordForm />
      </div>
    </main>
  );
}
