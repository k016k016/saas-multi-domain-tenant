'use client';

/**
 * メンバー編集モーダル
 *
 * 責務:
 * - メンバー情報の編集フォーム
 * - パスワード変更
 * - バリデーション
 * - Server Actionの呼び出し
 */

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { updateMember } from './actions';

interface Member {
  userId: string;
  email: string;
  name: string;
  role: 'owner' | 'admin' | 'member';
  status: 'active';
  createdAt: string;
}

interface EditMemberModalProps {
  member: Member;
  orgId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditMemberModal({
  member,
  orgId,
  onClose,
  onSuccess,
}: EditMemberModalProps) {
  const router = useRouter();
  const [name, setName] = useState(member.name);
  const [role, setRole] = useState<'member' | 'admin' | 'owner'>(member.role);
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isOwner = member.role === 'owner';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // パスワード確認
    if (password && password !== passwordConfirm) {
      setError('パスワードが一致しません');
      return;
    }

    setLoading(true);

    try {
      const result = await updateMember(
        orgId,
        member.userId,
        name,
        role,
        password || undefined
      );

      if (result.success) {
        onSuccess();
      } else {
        setError(result.error || '更新に失敗しました');
      }
    } catch (err) {
      setError('更新に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#27272a',
          padding: '2rem',
          borderRadius: '8px',
          width: '90%',
          maxWidth: '500px',
          border: '1px solid #3f3f46',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginTop: 0 }}>ユーザー情報を編集</h2>

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

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label
              htmlFor="edit-name"
              style={{ display: 'block', marginBottom: '0.5rem', color: '#a1a1aa' }}
            >
              氏名 *
            </label>
            <input
              id="edit-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '0.5rem',
                background: '#18181b',
                border: '1px solid #3f3f46',
                borderRadius: '4px',
                color: 'white',
              }}
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label
              htmlFor="edit-email"
              style={{ display: 'block', marginBottom: '0.5rem', color: '#a1a1aa' }}
            >
              メールアドレス
            </label>
            <input
              id="edit-email"
              type="email"
              value={member.email}
              disabled
              style={{
                width: '100%',
                padding: '0.5rem',
                background: '#18181b',
                border: '1px solid #3f3f46',
                borderRadius: '4px',
                color: '#71717a',
                cursor: 'not-allowed',
              }}
            />
            <p style={{ fontSize: '0.75rem', color: '#71717a', marginTop: '0.25rem' }}>
              メールアドレスは変更できません
            </p>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label
              htmlFor="edit-role"
              style={{ display: 'block', marginBottom: '0.5rem', color: '#a1a1aa' }}
            >
              ロール *
            </label>
            <select
              id="edit-role"
              value={role}
              onChange={(e) => setRole(e.target.value as 'member' | 'admin' | 'owner')}
              disabled={isOwner}
              required
              style={{
                width: '100%',
                padding: '0.5rem',
                background: '#18181b',
                border: '1px solid #3f3f46',
                borderRadius: '4px',
                color: isOwner ? '#71717a' : 'white',
                cursor: isOwner ? 'not-allowed' : 'pointer',
              }}
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
              <option value="owner">Owner</option>
            </select>
            {isOwner && (
              <p style={{ fontSize: '0.75rem', color: '#fbbf24', marginTop: '0.25rem' }}>
                Ownerのロールは変更できません
              </p>
            )}
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label
              htmlFor="edit-password"
              style={{ display: 'block', marginBottom: '0.5rem', color: '#a1a1aa' }}
            >
              新しいパスワード（変更する場合のみ）
            </label>
            <input
              id="edit-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              style={{
                width: '100%',
                padding: '0.5rem',
                background: '#18181b',
                border: '1px solid #3f3f46',
                borderRadius: '4px',
                color: 'white',
              }}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label
              htmlFor="edit-password-confirm"
              style={{ display: 'block', marginBottom: '0.5rem', color: '#a1a1aa' }}
            >
              新しいパスワード（確認）
            </label>
            <input
              id="edit-password-confirm"
              type="password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              minLength={6}
              style={{
                width: '100%',
                padding: '0.5rem',
                background: '#18181b',
                border: '1px solid #3f3f46',
                borderRadius: '4px',
                color: 'white',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                padding: '0.5rem 1rem',
                background: '#3f3f46',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '0.875rem',
              }}
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '0.5rem 1rem',
                background: loading ? '#1e40af' : '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '0.875rem',
              }}
            >
              {loading ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
