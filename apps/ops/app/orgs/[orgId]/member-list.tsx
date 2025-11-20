'use client';

/**
 * メンバー一覧（Client Component）
 *
 * 責務:
 * - メンバー一覧の表示
 * - 編集・削除ボタン
 */

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import EditMemberModal from './edit-member-modal';
import { deleteMember } from './actions';

interface Member {
  userId: string;
  email: string;
  name: string;
  role: 'owner' | 'admin' | 'member';
  status: 'active';
  createdAt: string;
}

interface MemberListProps {
  members: Member[];
  orgId: string;
  onEditSuccess: () => void;
  onDeleteSuccess: () => void;
}

export default function MemberList({
  members,
  orgId,
  onEditSuccess,
  onDeleteSuccess,
}: MemberListProps) {
  const router = useRouter();
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [error, setError] = useState('');
  const [loadingUserId, setLoadingUserId] = useState<string | null>(null);

  const handleDelete = async (member: Member) => {
    if (member.role === 'owner') {
      alert('ownerは削除できません');
      return;
    }

    if (!confirm(`「${member.name || member.email}」を削除してもよろしいですか？`)) {
      return;
    }

    setError('');
    setLoadingUserId(member.userId);

    try {
      const result = await deleteMember(orgId, member.userId);

      if (result.success) {
        onDeleteSuccess();
        router.refresh();
      } else {
        setError(result.error || '削除に失敗しました');
      }
    } catch (err) {
      setError('削除に失敗しました');
    } finally {
      setLoadingUserId(null);
    }
  };

  const handleEditSuccess = () => {
    setSelectedMember(null);
    onEditSuccess();
    router.refresh();
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

      <div style={{ overflowX: 'auto' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            background: '#27272a',
            borderRadius: '8px',
          }}
        >
          <thead>
            <tr style={{ borderBottom: '1px solid #3f3f46' }}>
              <th style={{ padding: '1rem', textAlign: 'left', color: '#a1a1aa' }}>氏名</th>
              <th style={{ padding: '1rem', textAlign: 'left', color: '#a1a1aa' }}>
                メールアドレス
              </th>
              <th style={{ padding: '1rem', textAlign: 'left', color: '#a1a1aa' }}>ロール</th>
              <th style={{ padding: '1rem', textAlign: 'left', color: '#a1a1aa' }}>
                登録日
              </th>
              <th style={{ padding: '1rem', textAlign: 'center', color: '#a1a1aa' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {members.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: '#71717a' }}>
                  メンバーが登録されていません
                </td>
              </tr>
            ) : (
              members.map((member) => (
                <tr key={member.userId} style={{ borderBottom: '1px solid #3f3f46' }}>
                  <td style={{ padding: '1rem' }}>{member.name || '-'}</td>
                  <td style={{ padding: '1rem', color: '#a1a1aa' }}>{member.email}</td>
                  <td style={{ padding: '1rem' }}>
                    <span
                      style={{
                        padding: '0.25rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        background:
                          member.role === 'owner'
                            ? '#7f1d1d'
                            : member.role === 'admin'
                              ? '#1e3a8a'
                              : '#422006',
                        color:
                          member.role === 'owner'
                            ? '#fca5a5'
                            : member.role === 'admin'
                              ? '#93c5fd'
                              : '#fde68a',
                      }}
                    >
                      {member.role}
                    </span>
                  </td>
                  <td style={{ padding: '1rem', color: '#a1a1aa', fontSize: '0.875rem' }}>
                    {member.createdAt}
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                      <button
                        onClick={() => setSelectedMember(member)}
                        style={{
                          padding: '0.5rem 1rem',
                          background: '#1e40af',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '0.875rem',
                        }}
                      >
                        編集
                      </button>
                      {member.role !== 'owner' && (
                        <button
                          onClick={() => handleDelete(member)}
                          disabled={loadingUserId === member.userId}
                          style={{
                            padding: '0.5rem 1rem',
                            background: loadingUserId === member.userId ? '#7f1d1d' : '#dc2626',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: loadingUserId === member.userId ? 'not-allowed' : 'pointer',
                            fontSize: '0.875rem',
                          }}
                        >
                          {loadingUserId === member.userId ? '削除中...' : '削除'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 編集モーダル */}
      {selectedMember && (
        <EditMemberModal
          member={selectedMember}
          orgId={orgId}
          onClose={() => setSelectedMember(null)}
          onSuccess={handleEditSuccess}
        />
      )}
    </>
  );
}
