'use client';

/**
 * ユーザー招待モーダル（Client Component）
 *
 * 責務:
 * - 新規ユーザーの招待フォーム（モーダル表示）
 * - パスワード確認フィールド付き
 */

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { inviteUser } from './actions';
import type { Role } from '@repo/config';

interface InviteUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function InviteUserModal({ isOpen, onClose, onSuccess }: InviteUserModalProps) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'member' | 'admin'>('member');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setPasswordConfirm('');
    setName('');
    setRole('member');
    setError('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // パスワードの確認チェック
    if (password !== passwordConfirm) {
      setError('パスワードが一致しません');
      return;
    }

    setIsLoading(true);

    try {
      const result = await inviteUser(email, password, name, role as Role);

      if (result.success) {
        resetForm();
        onSuccess();
        onClose();
        router.refresh();
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('ユーザーの招待に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={handleClose}
    >
      <div
        style={{
          background: '#1a1a1a',
          border: '1px solid #404040',
          borderRadius: '8px',
          padding: '1.5rem',
          width: '100%',
          maxWidth: '400px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: '0 0 1rem', fontSize: '1.25rem' }}>新規ユーザーを招待</h2>

        {error && (
          <div
            style={{
              padding: '0.75rem',
              marginBottom: '1rem',
              background: '#7f1d1d',
              border: '1px solid #ef4444',
              borderRadius: '4px',
              color: '#fca5a5',
              fontSize: '0.875rem',
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* 氏名 */}
          <div style={{ marginBottom: '1rem' }}>
            <label
              htmlFor="invite-name"
              style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}
            >
              氏名
            </label>
            <input
              id="invite-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isLoading}
              required
              placeholder="山田 太郎"
              style={{
                width: '100%',
                padding: '0.5rem',
                background: '#262626',
                color: '#e5e5e5',
                border: '1px solid #404040',
                borderRadius: '4px',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* メールアドレス */}
          <div style={{ marginBottom: '1rem' }}>
            <label
              htmlFor="invite-email"
              style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}
            >
              メールアドレス
            </label>
            <input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              required
              placeholder="user@example.com"
              style={{
                width: '100%',
                padding: '0.5rem',
                background: '#262626',
                color: '#e5e5e5',
                border: '1px solid #404040',
                borderRadius: '4px',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* パスワード */}
          <div style={{ marginBottom: '1rem' }}>
            <label
              htmlFor="invite-password"
              style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}
            >
              パスワード
            </label>
            <input
              id="invite-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              required
              placeholder="6文字以上"
              style={{
                width: '100%',
                padding: '0.5rem',
                background: '#262626',
                color: '#e5e5e5',
                border: '1px solid #404040',
                borderRadius: '4px',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* パスワード確認 */}
          <div style={{ marginBottom: '1rem' }}>
            <label
              htmlFor="invite-password-confirm"
              style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}
            >
              パスワード確認
            </label>
            <input
              id="invite-password-confirm"
              type="password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              disabled={isLoading}
              required
              placeholder="パスワードを再入力"
              style={{
                width: '100%',
                padding: '0.5rem',
                background: '#262626',
                color: '#e5e5e5',
                border: '1px solid #404040',
                borderRadius: '4px',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* ロール */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label
              htmlFor="invite-role"
              style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}
            >
              ロール
            </label>
            <select
              id="invite-role"
              value={role}
              onChange={(e) => setRole(e.target.value as 'member' | 'admin')}
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '0.5rem',
                background: '#262626',
                color: '#e5e5e5',
                border: '1px solid #404040',
                borderRadius: '4px',
                boxSizing: 'border-box',
              }}
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          {/* ボタン */}
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={handleClose}
              disabled={isLoading}
              style={{
                padding: '0.5rem 1rem',
                background: '#404040',
                color: '#e5e5e5',
                border: 'none',
                borderRadius: '4px',
                cursor: isLoading ? 'not-allowed' : 'pointer',
              }}
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={isLoading || !name || !email || !password || !passwordConfirm}
              style={{
                padding: '0.5rem 1rem',
                background: isLoading || !name || !email || !password || !passwordConfirm ? '#404040' : '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: isLoading || !name || !email || !password || !passwordConfirm ? 'not-allowed' : 'pointer',
              }}
            >
              {isLoading ? '追加中...' : '追加'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
