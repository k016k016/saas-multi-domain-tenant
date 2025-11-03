'use client';

/**
 * 組織切替フォーム（Client Component）
 *
 * 重要な設計方針:
 * - Server Actionを呼び出す
 * - Server ActionはnextUrlを返す（redirect()しない）
 * - このComponentがrouter.push(nextUrl)で遷移する
 */

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { switchOrganization } from './actions';

interface Organization {
  id: string;
  name: string;
  role: string;
}

interface SwitchOrgFormProps {
  organizations: Organization[];
  currentOrgId?: string;
}

export default function SwitchOrgForm({
  organizations,
  currentOrgId,
}: SwitchOrgFormProps) {
  const router = useRouter();
  const [selectedOrgId, setSelectedOrgId] = useState<string>(currentOrgId || '');
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // Server Actionを呼び出す
      const result = await switchOrganization(selectedOrgId);

      if (result.success) {
        // 成功: nextUrlに遷移
        if (result.nextUrl) {
          // 相対URLの場合はrouter.push()
          if (result.nextUrl.startsWith('/')) {
            router.push(result.nextUrl);
          } else {
            // フルURL（クロスドメイン）の場合はlocation.assign()
            window.location.assign(result.nextUrl);
          }
        }
      } else {
        // 失敗: エラーメッセージを表示
        setError(result.error || '組織の切り替えに失敗しました');
        setIsLoading(false);
      }
    } catch (err) {
      setError('組織の切り替えに失敗しました');
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
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

      <div style={{ marginBottom: '1rem' }}>
        <label
          htmlFor="org-select"
          style={{ display: 'block', marginBottom: '0.5rem' }}
        >
          組織を選択:
        </label>
        <select
          id="org-select"
          name="org_id"
          value={selectedOrgId}
          onChange={(e) => setSelectedOrgId(e.target.value)}
          disabled={isLoading}
          style={{
            width: '100%',
            padding: '0.5rem',
            background: '#2d2d2d',
            color: '#e5e5e5',
            border: '1px solid #404040',
            borderRadius: '4px',
          }}
        >
          {organizations.map((org) => (
            <option key={org.id} value={org.id}>
              {org.name} ({org.role}) {org.id === currentOrgId && '(現在)'}
            </option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        disabled={isLoading || selectedOrgId === currentOrgId}
        style={{
          padding: '0.5rem 1rem',
          background: selectedOrgId === currentOrgId ? '#404040' : '#3b82f6',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor:
            isLoading || selectedOrgId === currentOrgId
              ? 'not-allowed'
              : 'pointer',
        }}
      >
        {isLoading ? '切り替え中...' : '組織を切り替える'}
      </button>
    </form>
  );
}
