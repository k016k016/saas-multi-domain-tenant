'use client';

/**
 * 組織一覧ページ（Client Component）
 *
 * 責務:
 * - 編集モーダルの表示制御
 * - 組織一覧の表示
 */

import { useState } from 'react';
import OrgList from './org-list';
import EditOrgModal from './edit-org-modal';

interface Organization {
  id: string;
  name: string;
  slug: string | null;
  plan: string;
  is_active: boolean;
  created_at: string;
  member_count: number;
}

interface OrgsPageClientProps {
  organizations: Organization[];
}

export default function OrgsPageClient({ organizations }: OrgsPageClientProps) {
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [successMessage, setSuccessMessage] = useState('');

  const handleEditSuccess = () => {
    setSuccessMessage('組織を更新しました');
    setSelectedOrg(null);
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  const handleDeleteSuccess = () => {
    setSuccessMessage('組織を削除しました');
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  return (
    <div style={{ padding: '2rem' }}>
      <header style={{ marginBottom: '2rem' }}>
        <h1>Organizations / 組織一覧</h1>
        <p style={{ color: '#a1a1aa', marginTop: '0.5rem' }}>
          登録組織数: <strong>{organizations.length}</strong>
        </p>
      </header>

      {/* 成功メッセージ */}
      {successMessage && (
        <div
          style={{
            padding: '1rem',
            marginBottom: '1rem',
            background: '#14532d',
            border: '1px solid #22c55e',
            borderRadius: '4px',
            color: '#86efac',
          }}
        >
          {successMessage}
        </div>
      )}

      {/* 組織一覧 */}
      <section>
        <OrgList
          organizations={organizations}
          onEdit={setSelectedOrg}
          onDeleteSuccess={handleDeleteSuccess}
        />
      </section>

      {/* 編集モーダル */}
      {selectedOrg && (
        <EditOrgModal
          organization={selectedOrg}
          onClose={() => setSelectedOrg(null)}
          onSuccess={handleEditSuccess}
        />
      )}
    </div>
  );
}
