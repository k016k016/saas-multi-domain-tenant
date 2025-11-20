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
import { removeUser } from './actions';
import EditUserModal from './edit-user-modal';
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
  const [editingMember, setEditingMember] = useState<Member | null>(null);

  const handleEditSuccess = () => {
    router.refresh();
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
                    <span
                      style={{
                        ...getRoleBadgeStyle(member.role),
                        display: 'inline-block',
                        padding: '0.25rem 0.75rem',
                        borderRadius: '4px',
                        fontSize: '0.875rem',
                        fontWeight: isOwner ? 'bold' : 'normal',
                      }}
                    >
                      {member.role.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ padding: '1rem', color: '#a1a1aa', fontSize: '0.875rem' }}>
                    {member.createdAt}
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                      {/* 編集ボタン: 全員に表示 */}
                      <button
                        onClick={() => setEditingMember(member)}
                        disabled={isLoading}
                        style={{
                          padding: '0.25rem 0.75rem',
                          background: isLoading ? '#404040' : '#1e3a8a',
                          color: isLoading ? '#71717a' : '#93c5fd',
                          border: '1px solid #3b82f6',
                          borderRadius: '4px',
                          cursor: isLoading ? 'not-allowed' : 'pointer',
                          fontSize: '0.875rem',
                        }}
                      >
                        編集
                      </button>
                      {/* 削除ボタン: ownerは非表示 */}
                      {!isOwner && (
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
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 編集モーダル */}
      {editingMember && (
        <EditUserModal
          member={editingMember}
          isOpen={true}
          onClose={() => setEditingMember(null)}
          onSuccess={handleEditSuccess}
        />
      )}
    </>
  );
}
