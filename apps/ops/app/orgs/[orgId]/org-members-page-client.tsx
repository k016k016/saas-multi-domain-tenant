'use client';

/**
 * 組織メンバー管理ページ（Client Component）
 *
 * 責務:
 * - 招待モーダルの表示制御
 * - メンバー一覧の表示
 * - 組織情報の表示
 */

import { useState } from 'react';
import MemberList from './member-list';
import InviteMemberModal from './invite-member-modal';

interface Member {
  userId: string;
  email: string;
  name: string;
  role: 'owner' | 'admin' | 'member';
  status: 'active';
  createdAt: string;
}

interface OrgInfo {
  orgId: string;
  orgName: string;
  slug: string | null;
  plan: string;
  isActive: boolean;
}

interface OrgMembersPageClientProps {
  org: OrgInfo;
  members: Member[];
}

export default function OrgMembersPageClient({ org, members }: OrgMembersPageClientProps) {
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const handleInviteSuccess = () => {
    setSuccessMessage('ユーザーを追加しました');
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  const handleEditSuccess = () => {
    setSuccessMessage('ユーザー情報を更新しました');
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  const handleDeleteSuccess = () => {
    setSuccessMessage('ユーザーを削除しました');
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  return (
    <div style={{ padding: '2rem' }}>
      <header style={{ marginBottom: '2rem' }}>
        <div style={{ marginBottom: '1rem' }}>
          <a
            href="/orgs"
            style={{
              color: '#60a5fa',
              textDecoration: 'none',
              fontSize: '0.875rem',
            }}
          >
            ← 組織一覧に戻る
          </a>
        </div>
        <h1>Organization Members / 組織メンバー管理</h1>
        <div style={{ marginTop: '1rem', color: '#a1a1aa' }}>
          <p style={{ marginBottom: '0.5rem' }}>
            組織名: <strong>{org.orgName}</strong>
          </p>
          <p style={{ marginBottom: '0.5rem', fontSize: '0.875rem' }}>
            スラッグ: {org.slug || '-'} | プラン: {org.plan} | ステータス:{' '}
            {org.isActive ? '有効' : '無効'}
          </p>
          <p style={{ fontSize: '0.875rem' }}>
            現在のメンバー数: <strong>{members.length}</strong>人
          </p>
        </div>
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

      {/* ユーザー追加ボタン */}
      <section style={{ marginBottom: '2rem' }}>
        <button
          onClick={() => setIsInviteModalOpen(true)}
          style={{
            padding: '0.75rem 1.5rem',
            background: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: 'bold',
          }}
        >
          ＋ ユーザーを追加
        </button>
      </section>

      {/* メンバー一覧セクション */}
      <section>
        <h2 style={{ marginBottom: '1rem' }}>メンバー一覧</h2>
        <MemberList
          members={members}
          orgId={org.orgId}
          onEditSuccess={handleEditSuccess}
          onDeleteSuccess={handleDeleteSuccess}
        />
      </section>

      {/* 注意書き */}
      <section
        style={{
          marginTop: '2rem',
          padding: '1rem',
          background: '#422006',
          border: '1px solid #92400e',
          borderRadius: '4px',
        }}
      >
        <h3 style={{ margin: 0, color: '#fbbf24' }}>注意</h3>
        <ul
          style={{
            marginTop: '0.5rem',
            fontSize: '0.875rem',
            color: '#fde68a',
          }}
        >
          <li>ownerのロール変更・削除はできません</li>
          <li>adminは複数人設定可能です</li>
          <li>すべての操作はactivity_logsに記録されます</li>
        </ul>
      </section>

      {/* 招待モーダル */}
      <InviteMemberModal
        isOpen={isInviteModalOpen}
        orgId={org.orgId}
        onClose={() => setIsInviteModalOpen(false)}
        onSuccess={handleInviteSuccess}
      />
    </div>
  );
}
