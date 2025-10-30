/**
 * ログインページ (OTP認証)
 *
 * 責務:
 * - メールアドレス入力フォーム
 * - Supabase OTP (Magic Link) 送信
 * - 認証済みユーザーは app へリダイレクト
 */

import { LoginForm } from './login-form';

export default function LoginPage() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f9fafb',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '400px',
        padding: '2rem',
        background: 'white',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      }}>
        <h1 style={{ marginBottom: '1.5rem', fontSize: '1.5rem', textAlign: 'center' }}>
          ログイン
        </h1>
        <LoginForm />
      </div>
    </div>
  );
}
