'use client';

/**
 * メンバーリスト（Client Component）
 *
 * 責務:
 * - メンバー一覧の表示
 * - ロール変更ドロップダウン（ownerは変更不可）
 * - 削除ボタン（ownerは削除不可）
 *
 * 重要な設計方針:
 * - Server Actions (changeUserRole, removeUser) を呼び出す
 * - Server ActionはnextUrlを返す（redirect()しない）
 * - router.refresh()でページをリフレッシュしてリストを更新
 */

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { changeUserRole, removeUser } from './actions';
import type { Role } from '@repo/config';

interface Member {
  userId: string;
  email: string;
  name: string;
  role: 'owner' | 'admin' | 'member';
  status: 'active' | 'pending' | 'inactive';
  createdAt: string;
}

interface MemberListProps {
  members: Member[];
  currentUserRole: Role;
}

export default function MemberList({ members, currentUserRole }: MemberListProps) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loadingUserId, setLoadingUserId] = useState<string | null>(null);

  const handleRoleChange = async (userId: string, newRole: 'member' | 'admin') => {
    setError('');
    setLoadingUserId(userId);

    try {
      const result = await changeUserRole(userId, newRole as Role);

      if (result.success) {
        // 成功: ページをリフレッシュしてリストを更新
        router.refresh();
      } else {
        // 失敗: エラーメッセージを表示
        setError(result.error);
      }
    } catch (err) {
      setError('ロールの変更に失敗しました');
    } finally {
      setLoadingUserId(null);
    }
  };

  const handleRemove = async (userId: string, email: string) => {
    if (!confirm(`${email} を削除してもよろしいですか？`)) {
      return;
    }

    setError('');
    setLoadingUserId(userId);

    try {
      const result = await removeUser(userId);

      if (result.success) {
        // 成功: ページをリフレッシュしてリストを更新
        router.refresh();
      } else {
        // 失敗: エラーメッセージを表示
        setError(result.error);
      }
    } catch (err) {
      setError('ユーザーの削除に失敗しました');
    } finally {
      setLoadingUserId(null);
    }
  };

  const getRoleBadgeStyle = (role: string) => {
    switch (role) {
      case 'owner':
        return { background: '#7c2d12', color: '#fca5a5', border: '1px solid #dc2626' };
      case 'admin':
        return { background: '#1e3a8a', color: '#93c5fd', border: '1px solid #3b82f6' };
      case 'member':
        return { background: '#1e293b', color: '#cbd5e1', border: '1px solid #64748b' };
      default:
        return { background: '#262626', color: '#a1a1aa', border: '1px solid #404040' };
    }
  };

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case 'active':
        return { background: '#14532d', color: '#86efac', border: '1px solid #22c55e' };
      case 'pending':
        return { background: '#713f12', color: '#fde68a', border: '1px solid #eab308' };
      case 'inactive':
        return { background: '#3f3f46', color: '#a1a1aa', border: '1px solid #52525b' };
      default:
        return { background: '#262626', color: '#a1a1aa', border: '1px solid #404040' };
    }
  };

  return (
    <>
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

      <div
        style={{
          border: '1px solid #404040',
          borderRadius: '8px',
          overflow: 'hidden',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#262626', borderBottom: '1px solid #404040' }}>
              <th style={{ padding: '1rem', textAlign: 'left' }}>氏名</th>
              <th style={{ padding: '1rem', textAlign: 'left' }}>メールアドレス</th>
              <th style={{ padding: '1rem', textAlign: 'left' }}>ロール</th>
              <th style={{ padding: '1rem', textAlign: 'left' }}>ステータス</th>
              <th style={{ padding: '1rem', textAlign: 'left' }}>作成日</th>
              <th style={{ padding: '1rem', textAlign: 'center' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => {
              const isOwner = member.role === 'owner';
              const isLoading = loadingUserId === member.userId;

              return (
                <tr
                  key={member.userId}
                  style={{
                    borderBottom: '1px solid #404040',
                    background: isLoading ? '#262626' : 'transparent',
                  }}
                >
                  <td style={{ padding: '1rem' }}>{member.name || '-'}</td>
                  <td style={{ padding: '1rem' }}>{member.email}</td>
                  <td style={{ padding: '1rem' }}>
                    {isOwner ? (
                      // ownerはロール変更不可
                      <span
                        style={{
                          ...getRoleBadgeStyle(member.role),
                          display: 'inline-block',
                          padding: '0.25rem 0.75rem',
                          borderRadius: '4px',
                          fontSize: '0.875rem',
                          fontWeight: 'bold',
                        }}
                      >
                        OWNER
                      </span>
                    ) : (
                      // admin/memberはロール変更可能
                      <select
                        value={member.role}
                        onChange={(e) =>
                          handleRoleChange(member.userId, e.target.value as 'member' | 'admin')
                        }
                        disabled={isLoading}
                        style={{
                          padding: '0.25rem 0.5rem',
                          background: '#1a1a1a',
                          color: '#e5e5e5',
                          border: '1px solid #404040',
                          borderRadius: '4px',
                          fontSize: '0.875rem',
                        }}
                      >
                        <option value="member">Member</option>
                        <option value="admin">Admin</option>
                      </select>
                    )}
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <span
                      style={{
                        ...getStatusBadgeStyle(member.status),
                        display: 'inline-block',
                        padding: '0.25rem 0.75rem',
                        borderRadius: '4px',
                        fontSize: '0.875rem',
                      }}
                    >
                      {member.status}
                    </span>
                  </td>
                  <td style={{ padding: '1rem', color: '#a1a1aa', fontSize: '0.875rem' }}>
                    {member.createdAt}
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'center' }}>
                    {isOwner ? (
                      // ownerは削除不可
                      <span style={{ color: '#71717a', fontSize: '0.875rem' }}>削除不可</span>
                    ) : (
                      // admin/memberは削除可能
                      <button
                        onClick={() => handleRemove(member.userId, member.email)}
                        disabled={isLoading}
                        style={{
                          padding: '0.25rem 0.75rem',
                          background: isLoading ? '#404040' : '#7f1d1d',
                          color: isLoading ? '#71717a' : '#fca5a5',
                          border: '1px solid #dc2626',
                          borderRadius: '4px',
                          cursor: isLoading ? 'not-allowed' : 'pointer',
                          fontSize: '0.875rem',
                        }}
                      >
                        {isLoading ? '処理中...' : '削除'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
