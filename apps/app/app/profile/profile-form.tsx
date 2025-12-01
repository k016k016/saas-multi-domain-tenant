'use client';

/**
 * プロフィール編集フォーム (Client Component)
 *
 * 責務:
 * - 名前変更UI
 * - パスワード変更UI
 * - フォーム送信とローディング状態管理
 */

import { useState } from 'react';
import { updateProfile, updatePassword } from './actions';

interface ProfileFormProps {
  initialName: string;
  email: string;
  role: string;
}

export function ProfileForm({ initialName, email, role }: ProfileFormProps) {
  // 名前フォーム状態
  const [name, setName] = useState(initialName);
  const [nameLoading, setNameLoading] = useState(false);
  const [nameMessage, setNameMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // パスワードフォーム状態
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 名前更新ハンドラー
  const handleNameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNameLoading(true);
    setNameMessage(null);

    try {
      const result = await updateProfile(name);

      if (!result.success) {
        setNameMessage({ type: 'error', text: result.error || 'エラーが発生しました' });
      } else {
        setNameMessage({ type: 'success', text: '名前を更新しました' });
      }
    } catch {
      setNameMessage({ type: 'error', text: '予期しないエラーが発生しました' });
    } finally {
      setNameLoading(false);
    }
  };

  // パスワード更新ハンドラー
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordLoading(true);
    setPasswordMessage(null);

    try {
      const result = await updatePassword(password, confirmPassword);

      if (!result.success) {
        setPasswordMessage({ type: 'error', text: result.error || 'エラーが発生しました' });
      } else {
        setPasswordMessage({ type: 'success', text: 'パスワードを更新しました' });
        setPassword('');
        setConfirmPassword('');
      }
    } catch {
      setPasswordMessage({ type: 'error', text: '予期しないエラーが発生しました' });
    } finally {
      setPasswordLoading(false);
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '0.5rem',
    border: '1px solid #374151',
    borderRadius: '4px',
    fontSize: '1rem',
    background: '#1f2937',
    color: '#e5e5e5',
  };

  const labelStyle = {
    display: 'block',
    marginBottom: '0.5rem',
    fontSize: '0.875rem',
    fontWeight: '500' as const,
    color: '#9ca3af',
  };

  const buttonStyle = (loading: boolean) => ({
    width: '100%',
    padding: '0.75rem',
    background: loading ? '#4b5563' : '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '1rem',
    fontWeight: '500' as const,
    cursor: loading ? 'not-allowed' : 'pointer',
  });

  const messageStyle = (type: 'success' | 'error') => ({
    padding: '0.75rem',
    marginBottom: '1rem',
    borderRadius: '4px',
    fontSize: '0.875rem',
    background: type === 'error' ? '#7f1d1d' : '#14532d',
    color: type === 'error' ? '#fca5a5' : '#86efac',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* 読み取り専用情報 */}
      <div style={{ background: '#1f2937', padding: '1rem', borderRadius: '8px' }}>
        <h2 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem', color: '#e5e5e5' }}>
          アカウント情報
        </h2>
        <div style={{ marginBottom: '0.75rem' }}>
          <span style={{ color: '#9ca3af' }}>メールアドレス: </span>
          <span style={{ color: '#e5e5e5' }}>{email}</span>
        </div>
        <div>
          <span style={{ color: '#9ca3af' }}>ロール: </span>
          <span style={{ color: '#e5e5e5' }}>{role}</span>
        </div>
      </div>

      {/* 名前変更フォーム */}
      <form onSubmit={handleNameSubmit} data-testid="profile-name-form">
        <h2 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem', color: '#e5e5e5' }}>
          名前の変更
        </h2>
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="name" style={labelStyle}>
            名前
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={nameLoading}
            placeholder="お名前"
            style={inputStyle}
          />
        </div>

        {nameMessage && (
          <div style={messageStyle(nameMessage.type)}>
            {nameMessage.text}
          </div>
        )}

        <button type="submit" disabled={nameLoading} style={buttonStyle(nameLoading)}>
          {nameLoading ? '更新中...' : '名前を更新'}
        </button>
      </form>

      {/* パスワード変更フォーム */}
      <form onSubmit={handlePasswordSubmit} data-testid="profile-password-form">
        <h2 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem', color: '#e5e5e5' }}>
          パスワードの変更
        </h2>
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="password" style={labelStyle}>
            新しいパスワード
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={passwordLoading}
            placeholder="6文字以上"
            style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="confirmPassword" style={labelStyle}>
            パスワード（確認）
          </label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={passwordLoading}
            placeholder="もう一度入力してください"
            style={inputStyle}
          />
        </div>

        {passwordMessage && (
          <div style={messageStyle(passwordMessage.type)}>
            {passwordMessage.text}
          </div>
        )}

        <button type="submit" disabled={passwordLoading} style={buttonStyle(passwordLoading)}>
          {passwordLoading ? '更新中...' : 'パスワードを更新'}
        </button>
      </form>
    </div>
  );
}
