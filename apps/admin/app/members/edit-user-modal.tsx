'use client';

/**
 * ユーザー編集モーダル（Client Component）
 *
 * 責務:
 * - ユーザー情報（氏名・メール・ロール）の編集
 * - Server Action (updateUser) を呼び出す
 */

import { useState, useEffect } from 'react';
import { updateUser } from './actions';
import type { Role } from '@repo/config';

interface Member {
  userId: string;
  email: string;
  name: string;
  role: 'owner' | 'admin' | 'member';
}

interface EditUserModalProps {
  member: Member;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditUserModal({ member, isOpen, onClose, onSuccess }: EditUserModalProps) {
  const [name, setName] = useState(member.name);
  const [email, setEmail] = useState(member.email);
  const [role, setRole] = useState<'member' | 'admin'>(member.role === 'owner' ? 'admin' : member.role);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // モーダルが開くたびにフォームをリセット
  useEffect(() => {
    if (isOpen) {
      setName(member.name);
      setEmail(member.email);
      setRole(member.role === 'owner' ? 'admin' : member.role);
      setError('');
    }
  }, [isOpen, member]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const result = await updateUser(member.userId, name, email, role as Role);

      if (result.success) {
        onSuccess();
        onClose();
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('ユーザー情報の更新に失敗しました');
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
      onClick={onClose}
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
        <h2 style={{ margin: '0 0 1rem', fontSize: '1.25rem' }}>ユーザー情報を編集</h2>

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
              htmlFor="edit-name"
              style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}
            >
              氏名
            </label>
            <input
              id="edit-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isLoading}
              required
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
              htmlFor="edit-email"
              style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}
            >
              メールアドレス
            </label>
            <input
              id="edit-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              required
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
              htmlFor="edit-role"
              style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}
            >
              ロール
            </label>
            <select
              id="edit-role"
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
              onClick={onClose}
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
              disabled={isLoading || !name || !email}
              style={{
                padding: '0.5rem 1rem',
                background: isLoading || !name || !email ? '#404040' : '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: isLoading || !name || !email ? 'not-allowed' : 'pointer',
              }}
            >
              {isLoading ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
