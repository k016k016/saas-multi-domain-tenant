'use client';

/**
 * 組織一覧 UI (Client Component)
 *
 * 責務:
 * - 組織一覧をリスト表示
 * - 組織選択時に Server Action を呼び出し
 * - 選択後は app ホームへリダイレクト
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { switchOrganization } from './actions';

interface Org {
  id: string;
  name: string;
  role: string;
}

interface OrgListProps {
  orgs: Org[];
}

export function OrgList({ orgs }: OrgListProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  const handleSelectOrg = async (orgId: string) => {
    setLoading(orgId);

    try {
      const result = await switchOrganization(orgId);

      if (!result.success) {
        alert(`エラー: ${result.error}`);
      } else {
        // 成功 → app ホームへリダイレクト
        router.push('/');
        router.refresh();
      }
    } catch (err) {
      alert('予期しないエラーが発生しました');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {orgs.map((org) => (
        <button
          key={org.id}
          onClick={() => handleSelectOrg(org.id)}
          disabled={loading !== null}
          style={{
            padding: '1rem',
            border: '1px solid #d1d5db',
            borderRadius: '8px',
            background: loading === org.id ? '#f3f4f6' : 'white',
            cursor: loading !== null ? 'not-allowed' : 'pointer',
            textAlign: 'left',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            if (loading === null) {
              e.currentTarget.style.borderColor = '#0070f3';
              e.currentTarget.style.background = '#f0f9ff';
            }
          }}
          onMouseLeave={(e) => {
            if (loading === null) {
              e.currentTarget.style.borderColor = '#d1d5db';
              e.currentTarget.style.background = 'white';
            }
          }}
        >
          <div style={{ fontWeight: '500', fontSize: '1rem', marginBottom: '0.25rem' }}>
            {org.name}
          </div>
          <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
            ロール: {org.role}
          </div>
        </button>
      ))}
    </div>
  );
}
