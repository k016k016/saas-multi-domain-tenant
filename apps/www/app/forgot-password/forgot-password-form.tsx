'use client';

/**
 * パスワードリセットリクエストフォーム (Client Component)
 *
 * 責務:
 * - メールアドレス入力UI
 * - フォーム送信とローディング状態管理
 * - 送信完了メッセージ表示
 */

import { useState } from 'react';
import Link from 'next/link';
import { requestPasswordReset } from './actions';

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const result = await requestPasswordReset(email);

      if (!result.success) {
        setMessage({ type: 'error', text: result.error || 'エラーが発生しました' });
      } else {
        setSubmitted(true);
        setMessage({
          type: 'success',
          text: 'パスワードリセット用のメールを送信しました。メールをご確認ください。',
        });
      }
    } catch {
      setMessage({ type: 'error', text: '予期しないエラーが発生しました' });
    } finally {
      setLoading(false);
    }
  };

  // 送信完了後のメッセージ表示
  if (submitted) {
    return (
      <div data-testid="forgot-password-success">
        <div
          style={{
            padding: '1rem',
            marginBottom: '1rem',
            borderRadius: '4px',
            fontSize: '0.875rem',
            background: '#d1fae5',
            color: '#065f46',
          }}
        >
          {message?.text}
        </div>
        <Link
          href="/login"
          style={{
            display: 'block',
            textAlign: 'center',
            color: '#0070f3',
            textDecoration: 'none',
            fontSize: '0.875rem',
          }}
        >
          サインインページに戻る
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} data-testid="forgot-password-form">
      <div style={{ marginBottom: '1rem' }}>
        <label
          htmlFor="email"
          style={{
            display: 'block',
            marginBottom: '0.5rem',
            fontSize: '0.875rem',
            fontWeight: '500',
            color: '#374151',
          }}
        >
          メールアドレス
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
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
        {loading ? '送信中...' : 'リセットメールを送信'}
      </button>

      <p
        style={{
          marginTop: '1rem',
          fontSize: '0.875rem',
          color: '#6b7280',
          textAlign: 'center',
        }}
      >
        <Link href="/login" style={{ color: '#0070f3', textDecoration: 'none' }}>
          サインインページに戻る
        </Link>
      </p>
    </form>
  );
}
