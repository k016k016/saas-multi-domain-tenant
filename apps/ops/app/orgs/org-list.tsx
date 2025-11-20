'use client';

/**
 * 組織リスト（Client Component）
 *
 * 責務:
 * - 組織一覧の表示
 * - 編集・削除ボタン
 */

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { deleteOrganization } from './actions';

interface Organization {
  id: string;
  name: string;
  slug: string | null;
  plan: string;
  is_active: boolean;
  created_at: string;
  member_count: number;
}

interface OrgListProps {
  organizations: Organization[];
  onEdit: (org: Organization) => void;
  onDeleteSuccess: () => void;
}

export default function OrgList({ organizations, onEdit, onDeleteSuccess }: OrgListProps) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loadingOrgId, setLoadingOrgId] = useState<string | null>(null);

  const handleDelete = async (org: Organization) => {
    if (org.member_count > 0) {
      alert(`メンバーが${org.member_count}人存在するため削除できません。先にメンバーを削除してください。`);
      return;
    }

    if (!confirm(`組織「${org.name}」を削除してもよろしいですか？`)) {
      return;
    }

    setError('');
    setLoadingOrgId(org.id);

    try {
      const result = await deleteOrganization(org.id);

      if (result.success) {
        onDeleteSuccess();
        router.refresh();
      } else {
        // result.error は undefined の可能性があるため、フォールバックメッセージを用意する
        setError(result.error || '組織の削除に失敗しました');
      }
    } catch (err) {
      setError('組織の削除に失敗しました');
    } finally {
      setLoadingOrgId(null);
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
              <th style={{ padding: '1rem', textAlign: 'left', color: '#a1a1aa' }}>組織名</th>
              <th style={{ padding: '1rem', textAlign: 'left', color: '#a1a1aa' }}>スラッグ</th>
              <th style={{ padding: '1rem', textAlign: 'left', color: '#a1a1aa' }}>プラン</th>
              <th style={{ padding: '1rem', textAlign: 'left', color: '#a1a1aa' }}>ステータス</th>
              <th style={{ padding: '1rem', textAlign: 'left', color: '#a1a1aa' }}>メンバー数</th>
              <th style={{ padding: '1rem', textAlign: 'left', color: '#a1a1aa' }}>作成日</th>
              <th style={{ padding: '1rem', textAlign: 'center', color: '#a1a1aa' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {organizations.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: '#71717a' }}>
                  組織が登録されていません
                </td>
              </tr>
            ) : (
              organizations.map((org) => (
                <tr key={org.id} style={{ borderBottom: '1px solid #3f3f46' }}>
                  <td style={{ padding: '1rem' }}>
                    <a
                      href={`/orgs/${org.id}`}
                      style={{ color: '#60a5fa', textDecoration: 'none' }}
                    >
                      {org.name}
                    </a>
                  </td>
                  <td style={{ padding: '1rem', color: '#a1a1aa', fontSize: '0.875rem' }}>
                    {org.slug || '-'}
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <span
                      style={{
                        padding: '0.25rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        background: '#1e3a8a',
                        color: '#93c5fd',
                      }}
                    >
                      {org.plan}
                    </span>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <span
                      style={{
                        padding: '0.25rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        background: org.is_active ? '#14532d' : '#7f1d1d',
                        color: org.is_active ? '#86efac' : '#fca5a5',
                      }}
                    >
                      {org.is_active ? '有効' : '無効'}
                    </span>
                  </td>
                  <td style={{ padding: '1rem', color: '#a1a1aa' }}>{org.member_count}</td>
                  <td style={{ padding: '1rem', color: '#a1a1aa', fontSize: '0.875rem' }}>
                    {org.created_at}
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                      <button
                        onClick={() => onEdit(org)}
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
                      <button
                        onClick={() => handleDelete(org)}
                        disabled={loadingOrgId === org.id}
                        style={{
                          padding: '0.5rem 1rem',
                          background: loadingOrgId === org.id ? '#7f1d1d' : '#dc2626',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: loadingOrgId === org.id ? 'not-allowed' : 'pointer',
                          fontSize: '0.875rem',
                        }}
                      >
                        {loadingOrgId === org.id ? '削除中...' : '削除'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
