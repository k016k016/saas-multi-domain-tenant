'use client';

/**
 * ログインフォーム (Client Component)
 *
 * 責務:
 * - メールアドレス・パスワード入力UI
 * - フォーム送信とローディング状態管理
 * - OTP/Password 両方をサポート
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { sendOTP, signInWithPassword } from './actions';

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'otp' | 'password'>('password'); // デフォルトはpassword
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      if (mode === 'password') {
        // Password ログイン
        const result = await signInWithPassword(email, password);

        if (result.error) {
          setMessage({ type: 'error', text: result.error });
        } else {
          // ログイン成功 → app ドメインへリダイレクト
          const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://app.local.test:3002';
          router.push(appUrl);
        }
      } else {
        // OTP ログイン
        const result = await sendOTP(email);

        if (result.error) {
          setMessage({ type: 'error', text: result.error });
        } else {
          setMessage({
            type: 'success',
            text: 'ログインリンクをメールで送信しました。メールをご確認ください。'
          });
          setEmail('');
        }
      }
    } catch (err) {
      setMessage({ type: 'error', text: '予期しないエラーが発生しました' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* モード切替タブ */}
      <div style={{ display: 'flex', marginBottom: '1.5rem', borderBottom: '1px solid #d1d5db' }}>
        <button
          type="button"
          onClick={() => setMode('password')}
          style={{
            flex: 1,
            padding: '0.75rem',
            background: 'none',
            border: 'none',
            borderBottom: mode === 'password' ? '2px solid #0070f3' : '2px solid transparent',
            color: mode === 'password' ? '#0070f3' : '#6b7280',
            fontWeight: mode === 'password' ? '600' : '400',
            cursor: 'pointer',
          }}
        >
          パスワード
        </button>
        <button
          type="button"
          onClick={() => setMode('otp')}
          style={{
            flex: 1,
            padding: '0.75rem',
            background: 'none',
            border: 'none',
            borderBottom: mode === 'otp' ? '2px solid #0070f3' : '2px solid transparent',
            color: mode === 'otp' ? '#0070f3' : '#6b7280',
            fontWeight: mode === 'otp' ? '600' : '400',
            cursor: 'pointer',
          }}
        >
          Magic Link
        </button>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label
          htmlFor="email"
          style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500' }}
        >
          メールアドレス
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={loading}
          placeholder="you@example.com"
          style={{
            width: '100%',
            padding: '0.5rem',
            border: '1px solid #d1d5db',
            borderRadius: '4px',
            fontSize: '1rem',
          }}
        />
      </div>

      {mode === 'password' && (
        <div style={{ marginBottom: '1rem' }}>
          <label
            htmlFor="password"
            style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500' }}
          >
            パスワード
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required={mode === 'password'}
            disabled={loading}
            placeholder="••••••••"
            style={{
              width: '100%',
              padding: '0.5rem',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              fontSize: '1rem',
            }}
          />
        </div>
      )}

      {message && (
        <div
          style={{
            padding: '0.75rem',
            marginBottom: '1rem',
            borderRadius: '4px',
            fontSize: '0.875rem',
            background: message.type === 'error' ? '#fee2e2' : '#d1fae5',
            color: message.type === 'error' ? '#991b1b' : '#065f46',
          }}
        >
          {message.text}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        style={{
          width: '100%',
          padding: '0.75rem',
          background: loading ? '#9ca3af' : '#0070f3',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          fontSize: '1rem',
          fontWeight: '500',
          cursor: loading ? 'not-allowed' : 'pointer',
        }}
      >
        {loading ? '送信中...' : mode === 'password' ? 'ログイン' : 'ログインリンクを送信'}
      </button>

      <p style={{ marginTop: '1rem', fontSize: '0.75rem', color: '#6b7280', textAlign: 'center' }}>
        {mode === 'password'
          ? 'メールアドレスとパスワードでログインします。'
          : 'メールアドレスにログインリンクが送信されます。'}
      </p>
    </form>
  );
}
