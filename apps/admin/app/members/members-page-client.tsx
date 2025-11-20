'use client';

/**
 * メンバー管理ページ（Client Component）
 *
 * 責務:
 * - 招待モーダルの表示制御
 * - メンバー一覧の表示
 */

import { useState } from 'react';
import type { Role } from '@repo/config';
import MemberList from './member-list';
import InviteUserModal from './invite-user-modal';

interface Member {
  userId: string;
  email: string;
  name: string;
  role: 'owner' | 'admin' | 'member';
  status: 'active' | 'pending' | 'inactive';
  createdAt: string;
}

interface MembersPageClientProps {
  org: { orgId: string; orgName: string };
  members: Member[];
  currentUserRole: Role;
}

export default function MembersPageClient({ org, members, currentUserRole }: MembersPageClientProps) {
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const handleInviteSuccess = () => {
    setSuccessMessage('ユーザーを追加しました');
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  return (
    <div style={{ padding: '2rem' }}>
      <header style={{ marginBottom: '2rem' }}>
        <h1>Members / メンバー管理</h1>
        <p style={{ color: '#a1a1aa', marginTop: '0.5rem' }}>
          組織: <strong>{org?.orgName ?? 'unknown'}</strong> ({org?.orgId ?? 'unknown'})
        </p>
        <p style={{ color: '#a1a1aa', fontSize: '0.875rem' }}>
          現在のメンバー数: {members.filter((m) => m.status === 'active').length}人
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
        {currentUserRole && <MemberList members={members} currentUserRole={currentUserRole} />}
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
      <InviteUserModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        onSuccess={handleInviteSuccess}
      />
    </div>
  );
}
