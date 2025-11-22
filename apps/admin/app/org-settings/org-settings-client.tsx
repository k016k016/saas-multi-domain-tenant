'use client';

/**
 * org-settings Client Component
 *
 * 責務:
 * - owner権限譲渡フォーム
 * - 組織凍結・解除ボタン
 * - 組織廃止フォーム
 * - 確認ダイアログ
 * - エラー・成功メッセージ表示
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { transferOwnership, freezeOrganization, unfreezeOrganization, archiveOrganization } from './actions';

interface Member {
  userId: string;
  email: string;
  name: string;
  role: 'owner' | 'admin' | 'member';
}

interface OrgSettingsClientProps {
  orgName: string;
  members: Member[];
  isActive: boolean;
}

export default function OrgSettingsClient({ orgName, members, isActive }: OrgSettingsClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // owner権限譲渡
  const [selectedNewOwner, setSelectedNewOwner] = useState('');
  const [showTransferConfirm, setShowTransferConfirm] = useState(false);

  // 組織凍結
  const [freezeReason, setFreezeReason] = useState('');
  const [showFreezeConfirm, setShowFreezeConfirm] = useState(false);

  // 組織廃止
  const [archiveConfirmation, setArchiveConfirmation] = useState('');
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);

  // owner以外のメンバー（譲渡先候補）
  const transferCandidates = members.filter(m => m.role !== 'owner');

  const handleTransferOwnership = () => {
    if (!selectedNewOwner) {
      setMessage({ type: 'error', text: '譲渡先ユーザーを選択してください' });
      return;
    }
    setShowTransferConfirm(true);
  };

  const confirmTransferOwnership = () => {
    startTransition(async () => {
      const result = await transferOwnership(selectedNewOwner);
      if (result.success) {
        setMessage({ type: 'success', text: '成功：owner権限を譲渡しました。あなたはadminに降格されました。' });
        setShowTransferConfirm(false);
        setSelectedNewOwner('');
        router.refresh();
      } else {
        setMessage({ type: 'error', text: result.error || '譲渡に失敗しました' });
        setShowTransferConfirm(false);
      }
    });
  };

  const handleFreezeOrganization = () => {
    if (!freezeReason.trim()) {
      setMessage({ type: 'error', text: '凍結理由を入力してください' });
      return;
    }
    setShowFreezeConfirm(true);
  };

  const confirmFreezeOrganization = () => {
    startTransition(async () => {
      const result = await freezeOrganization(freezeReason);
      if (result.success) {
        setMessage({ type: 'success', text: '成功：組織を凍結しました' });
        setShowFreezeConfirm(false);
        setFreezeReason('');
        router.refresh();
      } else {
        setMessage({ type: 'error', text: result.error || '凍結に失敗しました' });
        setShowFreezeConfirm(false);
      }
    });
  };

  const handleUnfreezeOrganization = () => {
    startTransition(async () => {
      const result = await unfreezeOrganization();
      if (result.success) {
        setMessage({ type: 'success', text: '成功：凍結を解除しました' });
        router.refresh();
      } else {
        setMessage({ type: 'error', text: result.error || '解除に失敗しました' });
      }
    });
  };

  const handleArchiveOrganization = () => {
    if (archiveConfirmation !== orgName) {
      setMessage({ type: 'error', text: '組織名が一致しません' });
      return;
    }
    setShowArchiveConfirm(true);
  };

  const confirmArchiveOrganization = () => {
    startTransition(async () => {
      const result = await archiveOrganization(archiveConfirmation);
      if (result.success) {
        setMessage({ type: 'success', text: '成功：組織を廃止しました' });
        setShowArchiveConfirm(false);
        setArchiveConfirmation('');
        router.refresh();
      } else {
        setMessage({ type: 'error', text: result.error || '廃止に失敗しました' });
        setShowArchiveConfirm(false);
      }
    });
  };

  return (
    <div>
      {/* メッセージ表示 */}
      {message && (
        <div
          style={{
            padding: '1rem',
            marginBottom: '1.5rem',
            background: message.type === 'success' ? '#065f46' : '#7f1d1d',
            border: `1px solid ${message.type === 'success' ? '#10b981' : '#dc2626'}`,
            borderRadius: '8px',
            color: message.type === 'success' ? '#d1fae5' : '#fca5a5',
          }}
        >
          {message.text}
        </div>
      )}

      {/* owner権限の譲渡 */}
      <section style={{ marginTop: '2rem', padding: '1.5rem', border: '2px solid #dc2626', borderRadius: '8px', background: '#7f1d1d' }}>
        <h3 style={{ color: '#fca5a5', marginTop: 0 }}>owner権限の譲渡</h3>
        <p style={{ fontSize: '0.875rem', color: '#fca5a5' }}>
          新しいownerを指名し、自分は降格します。各組織にownerは必ず1人必要です。
        </p>
        <p style={{ fontSize: '0.875rem', color: '#f87171', fontWeight: 'bold', marginTop: '0.5rem' }}>
          ⚠️ この操作は取り消せません
        </p>

        <div style={{ marginTop: '1rem' }}>
          <label htmlFor="new-owner" style={{ display: 'block', fontSize: '0.875rem', color: '#fca5a5', marginBottom: '0.5rem' }}>
            新しいownerを選択
          </label>
          <select
            id="new-owner"
            value={selectedNewOwner}
            onChange={(e) => setSelectedNewOwner(e.target.value)}
            disabled={isPending}
            style={{
              padding: '0.5rem',
              background: '#262626',
              color: '#e5e5e5',
              border: '1px solid #404040',
              borderRadius: '4px',
              width: '100%',
              maxWidth: '400px',
            }}
          >
            <option value="">選択してください</option>
            {transferCandidates.map((member) => (
              <option key={member.userId} value={member.userId}>
                {member.name || member.email} ({member.role})
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={handleTransferOwnership}
          disabled={isPending}
          style={{
            marginTop: '1rem',
            padding: '0.5rem 1rem',
            background: '#dc2626',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isPending ? 'not-allowed' : 'pointer',
            opacity: isPending ? 0.5 : 1,
          }}
        >
          {isPending ? '処理中...' : 'owner権限を譲渡'}
        </button>

        <p style={{ fontSize: '0.75rem', color: '#f87171', marginTop: '0.5rem' }}>
          ※ この操作は activity_logs に記録されます
        </p>
      </section>

      {/* 組織の凍結 / 解除 */}
      <section style={{ marginTop: '2rem', padding: '1.5rem', border: '1px solid #dc2626', borderRadius: '8px', background: '#7f1d1d' }}>
        <h3 style={{ color: '#fca5a5', marginTop: 0 }}>組織の凍結 / 解除</h3>
        <p style={{ fontSize: '0.875rem', color: '#fca5a5' }}>
          組織を一時的に凍結（is_active=false）、または凍結を解除できます。
        </p>

        {isActive ? (
          <div style={{ marginTop: '1rem' }}>
            <label htmlFor="freeze-reason" style={{ display: 'block', fontSize: '0.875rem', color: '#fca5a5', marginBottom: '0.5rem' }}>
              凍結理由
            </label>
            <input
              id="freeze-reason"
              type="text"
              value={freezeReason}
              onChange={(e) => setFreezeReason(e.target.value)}
              disabled={isPending}
              placeholder="凍結理由を入力してください"
              style={{
                padding: '0.5rem',
                background: '#262626',
                color: '#e5e5e5',
                border: '1px solid #404040',
                borderRadius: '4px',
                width: '100%',
                maxWidth: '400px',
              }}
            />
            <button
              onClick={handleFreezeOrganization}
              disabled={isPending}
              style={{
                marginTop: '1rem',
                padding: '0.5rem 1rem',
                background: '#f59e0b',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: isPending ? 'not-allowed' : 'pointer',
                opacity: isPending ? 0.5 : 1,
              }}
            >
              {isPending ? '処理中...' : '組織を凍結'}
            </button>
          </div>
        ) : (
          <button
            onClick={handleUnfreezeOrganization}
            disabled={isPending}
            style={{
              marginTop: '1rem',
              padding: '0.5rem 1rem',
              background: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: isPending ? 'not-allowed' : 'pointer',
              opacity: isPending ? 0.5 : 1,
            }}
          >
            {isPending ? '処理中...' : '凍結解除'}
          </button>
        )}

        <p style={{ fontSize: '0.75rem', color: '#f87171', marginTop: '0.5rem' }}>
          ※ この操作は activity_logs に記録されます
        </p>
      </section>

      {/* 組織の廃止 */}
      <section style={{ marginTop: '2rem', padding: '1.5rem', border: '2px solid #dc2626', borderRadius: '8px', background: '#7f1d1d' }}>
        <h3 style={{ color: '#fca5a5', marginTop: 0 }}>組織の廃止</h3>
        <p style={{ fontSize: '0.875rem', color: '#fca5a5' }}>
          組織を完全に廃止します。廃止後はアクセスできなくなります。
        </p>
        <p style={{ fontSize: '0.875rem', color: '#f87171', fontWeight: 'bold', marginTop: '0.5rem' }}>
          ⚠️ この操作は取り消せません
        </p>

        <div style={{ marginTop: '1rem' }}>
          <label htmlFor="archive-confirmation" style={{ display: 'block', fontSize: '0.875rem', color: '#fca5a5', marginBottom: '0.5rem' }}>
            確認のため、組織名「{orgName}」を入力してください
          </label>
          <input
            id="archive-confirmation"
            type="text"
            value={archiveConfirmation}
            onChange={(e) => setArchiveConfirmation(e.target.value)}
            disabled={isPending}
            placeholder={`組織名を入力: ${orgName}`}
            style={{
              padding: '0.5rem',
              background: '#262626',
              color: '#e5e5e5',
              border: '1px solid #404040',
              borderRadius: '4px',
              width: '100%',
              maxWidth: '400px',
            }}
          />
        </div>

        <button
          onClick={handleArchiveOrganization}
          disabled={isPending}
          style={{
            marginTop: '1rem',
            padding: '0.5rem 1rem',
            background: '#dc2626',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isPending ? 'not-allowed' : 'pointer',
            opacity: isPending ? 0.5 : 1,
          }}
        >
          {isPending ? '処理中...' : '組織を廃止'}
        </button>

        <p style={{ fontSize: '0.75rem', color: '#f87171', marginTop: '0.5rem' }}>
          ※ この操作は activity_logs に記録されます
        </p>
      </section>

      {/* 確認ダイアログ: owner権限譲渡 */}
      {showTransferConfirm && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setShowTransferConfirm(false)}
        >
          <div
            style={{
              background: '#1a1a1a',
              padding: '2rem',
              borderRadius: '8px',
              border: '1px solid #404040',
              maxWidth: '500px',
              width: '90%',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0, color: '#fca5a5' }}>owner権限譲渡の確認</h3>
            <p style={{ color: '#e5e5e5' }}>
              本当にowner権限を譲渡しますか？あなたはadminに降格されます。
            </p>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
              <button
                onClick={confirmTransferOwnership}
                disabled={isPending}
                style={{
                  flex: 1,
                  padding: '0.5rem 1rem',
                  background: '#dc2626',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: isPending ? 'not-allowed' : 'pointer',
                }}
              >
                {isPending ? '処理中...' : '譲渡する'}
              </button>
              <button
                onClick={() => setShowTransferConfirm(false)}
                disabled={isPending}
                style={{
                  flex: 1,
                  padding: '0.5rem 1rem',
                  background: '#404040',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: isPending ? 'not-allowed' : 'pointer',
                }}
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 確認ダイアログ: 組織凍結 */}
      {showFreezeConfirm && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setShowFreezeConfirm(false)}
        >
          <div
            style={{
              background: '#1a1a1a',
              padding: '2rem',
              borderRadius: '8px',
              border: '1px solid #404040',
              maxWidth: '500px',
              width: '90%',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0, color: '#fca5a5' }}>組織凍結の確認</h3>
            <p style={{ color: '#e5e5e5' }}>
              本当に組織を凍結しますか？全ユーザーが読み取り専用になります。
            </p>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
              <button
                onClick={confirmFreezeOrganization}
                disabled={isPending}
                style={{
                  flex: 1,
                  padding: '0.5rem 1rem',
                  background: '#f59e0b',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: isPending ? 'not-allowed' : 'pointer',
                }}
              >
                {isPending ? '処理中...' : '実行'}
              </button>
              <button
                onClick={() => setShowFreezeConfirm(false)}
                disabled={isPending}
                style={{
                  flex: 1,
                  padding: '0.5rem 1rem',
                  background: '#404040',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: isPending ? 'not-allowed' : 'pointer',
                }}
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 確認ダイアログ: 組織廃止 */}
      {showArchiveConfirm && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setShowArchiveConfirm(false)}
        >
          <div
            style={{
              background: '#1a1a1a',
              padding: '2rem',
              borderRadius: '8px',
              border: '1px solid #404040',
              maxWidth: '500px',
              width: '90%',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0, color: '#fca5a5' }}>組織廃止の確認</h3>
            <p style={{ color: '#e5e5e5' }}>
              本当に組織を廃止しますか？廃止後はアクセスできなくなります。
            </p>
            <p style={{ color: '#f87171', fontWeight: 'bold' }}>
              ⚠️ この操作は取り消せません
            </p>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
              <button
                onClick={confirmArchiveOrganization}
                disabled={isPending}
                style={{
                  flex: 1,
                  padding: '0.5rem 1rem',
                  background: '#dc2626',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: isPending ? 'not-allowed' : 'pointer',
                }}
              >
                {isPending ? '処理中...' : '廃止する'}
              </button>
              <button
                onClick={() => setShowArchiveConfirm(false)}
                disabled={isPending}
                style={{
                  flex: 1,
                  padding: '0.5rem 1rem',
                  background: '#404040',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: isPending ? 'not-allowed' : 'pointer',
                }}
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
