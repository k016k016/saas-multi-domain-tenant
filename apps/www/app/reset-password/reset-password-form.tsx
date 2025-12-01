'use client';

/**
 * パスワードリセットフォーム (Client Component)
 *
 * 責務:
 * - 新パスワード入力UI
 * - フォーム送信とローディング状態管理
 * - 成功後のリダイレクト
 */

import { useState } from 'react';
import Link from 'next/link';
import { updatePassword } from './actions';

export function ResetPasswordForm() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const result = await updatePassword(password, confirmPassword);

      if (!result.success) {
        setMessage({ type: 'error', text: result.error || 'エラーが発生しました' });
      } else {
        // パスワード更新成功 → ログインページへ遷移
        setMessage({ type: 'success', text: 'パスワードを更新しました。ログインページへ移動します...' });
        setTimeout(() => {
          if (result.nextUrl) {
            window.location.assign(result.nextUrl);
          }
        }, 1500);
      }
    } catch {
      setMessage({ type: 'error', text: '予期しないエラーが発生しました' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} data-testid="reset-password-form">
      <div style={{ marginBottom: '1rem' }}>
        <label
          htmlFor="password"
          style={{
            display: 'block',
            marginBottom: '0.5rem',
            fontSize: '0.875rem',
            fontWeight: '500',
            color: '#374151',
          }}
        >
          新しいパスワード
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading}
          placeholder="6文字以上"
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
          htmlFor="confirmPassword"
          style={{
            display: 'block',
            marginBottom: '0.5rem',
            fontSize: '0.875rem',
            fontWeight: '500',
            color: '#374151',
          }}
        >
          パスワード（確認）
        </label>
        <input
          id="confirmPassword"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          disabled={loading}
          placeholder="もう一度入力してください"
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
        {loading ? '更新中...' : 'パスワードを更新'}
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
