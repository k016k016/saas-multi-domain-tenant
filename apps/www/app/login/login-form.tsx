'use client';

/**
 * サインインフォーム (Client Component)
 *
 * 責務:
 * - メールアドレス・パスワード入力UI
 * - フォーム送信とローディング状態管理
 * - パスワード認証のみをサポート
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithPassword } from './actions';

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const result = await signInWithPassword(email, password);

      if (!result.success) {
        setMessage({ type: 'error', text: result.error });
      } else {
        // サインイン成功 → Server Action が返した nextUrl へ遷移
        const nextUrl = result.nextUrl || process.env.NEXT_PUBLIC_APP_URL || 'http://app.local.test:3002';
        // nextUrl が相対パスの場合は router.push、フルURLの場合は location.assign
        if (nextUrl.startsWith('/')) {
          router.push(nextUrl);
        } else {
          window.location.assign(nextUrl);
        }
      }
    } catch (err) {
      setMessage({ type: 'error', text: '予期しないエラーが発生しました' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} data-testid="login-form">
      <div style={{ marginBottom: '1rem' }}>
        <label
          htmlFor="email"
          style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}
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

      <div style={{ marginBottom: '1rem' }}>
        <label
          htmlFor="password"
          style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}
        >
          パスワード
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
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
        {loading ? '送信中...' : 'サインイン'}
      </button>

      <p style={{ marginTop: '1rem', fontSize: '0.75rem', color: '#6b7280', textAlign: 'center' }}>
        メールアドレスとパスワードでサインインします。
      </p>
    </form>
  );
}
