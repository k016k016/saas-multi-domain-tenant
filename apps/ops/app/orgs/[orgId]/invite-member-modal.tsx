'use client';

/**
 * メンバー招待モーダル
 *
 * 責務:
 * - 新規ユーザーの招待フォーム
 * - バリデーション
 * - Server Actionの呼び出し
 */

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { inviteMember } from './actions';

interface InviteMemberModalProps {
  isOpen: boolean;
  orgId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function InviteMemberModal({
  isOpen,
  orgId,
  onClose,
  onSuccess,
}: InviteMemberModalProps) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [role, setRole] = useState<'member' | 'admin' | 'owner'>('member');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // パスワード確認
    if (password !== passwordConfirm) {
      setError('パスワードが一致しません');
      return;
    }

    setLoading(true);

    try {
      const result = await inviteMember(orgId, name, email, password, role);

      if (result.success) {
        // フォームをリセット
        setName('');
        setEmail('');
        setPassword('');
        setPasswordConfirm('');
        setRole('member');
        onSuccess();
        router.refresh();
        onClose();
      } else {
        setError(result.error || '招待に失敗しました');
      }
    } catch (err) {
      setError('招待に失敗しました');
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
        <h2 style={{ marginTop: 0 }}>新規ユーザーを招待</h2>

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
              htmlFor="invite-name"
              style={{ display: 'block', marginBottom: '0.5rem', color: '#a1a1aa' }}
            >
              氏名 *
            </label>
            <input
              id="invite-name"
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
              htmlFor="invite-email"
              style={{ display: 'block', marginBottom: '0.5rem', color: '#a1a1aa' }}
            >
              メールアドレス *
            </label>
            <input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
              htmlFor="invite-password"
              style={{ display: 'block', marginBottom: '0.5rem', color: '#a1a1aa' }}
            >
              パスワード *
            </label>
            <input
              id="invite-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
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

          <div style={{ marginBottom: '1rem' }}>
            <label
              htmlFor="invite-password-confirm"
              style={{ display: 'block', marginBottom: '0.5rem', color: '#a1a1aa' }}
            >
              パスワード（確認） *
            </label>
            <input
              id="invite-password-confirm"
              type="password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              required
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
              htmlFor="invite-role"
              style={{ display: 'block', marginBottom: '0.5rem', color: '#a1a1aa' }}
            >
              ロール *
            </label>
            <select
              id="invite-role"
              value={role}
              onChange={(e) => setRole(e.target.value as 'member' | 'admin' | 'owner')}
              required
              style={{
                width: '100%',
                padding: '0.5rem',
                background: '#18181b',
                border: '1px solid #3f3f46',
                borderRadius: '4px',
                color: 'white',
              }}
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
              <option value="owner">Owner</option>
            </select>
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
              {loading ? '追加中...' : '追加'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
