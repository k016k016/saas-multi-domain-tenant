'use client';

/**
 * ユーザー招待フォーム（Client Component）
 *
 * 重要な設計方針:
 * - Server Action (inviteUser) を呼び出す
 * - Server ActionはnextUrlを返す（redirect()しない）
 * - このComponentがrouter.push(nextUrl)で遷移する
 */

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { inviteUser } from './actions';
import type { Role } from '@repo/config';

export default function InviteUserForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'member' | 'admin'>('member');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      // Server Actionを呼び出す
      const result = await inviteUser(email, role as Role);

      if (result.success) {
        // 成功: フォームをリセットして成功メッセージを表示
        setEmail('');
        setRole('member');
        setSuccess(`${email} に招待メールを送信しました`);
        setIsLoading(false);

        // ページをリフレッシュしてメンバーリストを更新
        router.refresh();
      } else {
        // 失敗: エラーメッセージを表示
        setError(result.error);
        setIsLoading(false);
      }
    } catch (err) {
      setError('ユーザーの招待に失敗しました');
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && (
        <div
          style={{
            padding: '1rem',
            marginBottom: '1rem',
            background: '#7f1d1d',
            border: '1px solid #ef4444',
            borderRadius: '4px',
            color: '#fca5a5',
          }}
        >
          {error}
        </div>
      )}

      {success && (
        <div
          style={{
            padding: '1rem',
            marginBottom: '1rem',
            background: '#14532d',
            border: '1px solid #22c55e',
            borderRadius: '4px',
            color: '#86efac',
          }}
        >
          {success}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px auto', gap: '1rem', alignItems: 'end' }}>
        {/* メールアドレス入力 */}
        <div>
          <label
            htmlFor="email"
            style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}
          >
            メールアドレス
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isLoading}
            required
            placeholder="user@example.com"
            style={{
              width: '100%',
              padding: '0.5rem',
              background: '#1a1a1a',
              color: '#e5e5e5',
              border: '1px solid #404040',
              borderRadius: '4px',
            }}
          />
        </div>

        {/* ロール選択 */}
        <div>
          <label
            htmlFor="role"
            style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}
          >
            ロール
          </label>
          <select
            id="role"
            value={role}
            onChange={(e) => setRole(e.target.value as 'member' | 'admin')}
            disabled={isLoading}
            style={{
              width: '100%',
              padding: '0.5rem',
              background: '#1a1a1a',
              color: '#e5e5e5',
              border: '1px solid #404040',
              borderRadius: '4px',
            }}
          >
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        {/* 招待ボタン */}
        <button
          type="submit"
          disabled={isLoading || !email}
          style={{
            padding: '0.5rem 1.5rem',
            background: !email || isLoading ? '#404040' : '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: !email || isLoading ? 'not-allowed' : 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {isLoading ? '送信中...' : '招待する'}
        </button>
      </div>
    </form>
  );
}
