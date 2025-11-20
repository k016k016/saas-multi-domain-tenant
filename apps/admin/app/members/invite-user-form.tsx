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
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
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
      const result = await inviteUser(email, password, name, role as Role);

      if (result.success) {
        // 成功: フォームをリセットして成功メッセージを表示
        setEmail('');
        setPassword('');
        setName('');
        setRole('member');
        setSuccess(`${name || email} を追加しました`);
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 120px auto', gap: '0.75rem', alignItems: 'end' }}>
        {/* 氏名入力 */}
        <div>
          <label
            htmlFor="name"
            style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}
          >
            氏名
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isLoading}
            required
            placeholder="山田 太郎"
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

        {/* パスワード入力 */}
        <div>
          <label
            htmlFor="password"
            style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}
          >
            パスワード
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
            required
            placeholder="••••••••"
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

        {/* 追加ボタン */}
        <button
          type="submit"
          disabled={isLoading || !email || !password || !name}
          style={{
            padding: '0.5rem 1rem',
            background: !email || !password || !name || isLoading ? '#404040' : '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: !email || !password || !name || isLoading ? 'not-allowed' : 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {isLoading ? '追加中...' : '追加'}
        </button>
      </div>
    </form>
  );
}
