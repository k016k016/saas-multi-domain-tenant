'use client';

/**
 * 組織編集モーダル
 *
 * 責務:
 * - 組織情報の編集フォーム
 * - バリデーション
 * - Server Actionの呼び出し
 */

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { updateOrganization } from './actions';

interface Organization {
  id: string;
  name: string;
  slug: string | null;
  plan: string;
  is_active: boolean;
  created_at: string;
  member_count: number;
}

interface EditOrgModalProps {
  organization: Organization;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditOrgModal({ organization, onClose, onSuccess }: EditOrgModalProps) {
  const router = useRouter();
  const [name, setName] = useState(organization.name);
  const [slug, setSlug] = useState(organization.slug || '');
  const [plan, setPlan] = useState(organization.plan);
  const [isActive, setIsActive] = useState(organization.is_active);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await updateOrganization(
        organization.id,
        name,
        slug || null,
        plan,
        isActive
      );

      if (result.success) {
        onSuccess();
        router.refresh();
      } else {
        setError(result.error || '更新に失敗しました');
      }
    } catch (err) {
      setError('更新に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#27272a',
          padding: '2rem',
          borderRadius: '8px',
          width: '90%',
          maxWidth: '500px',
          border: '1px solid #3f3f46',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginTop: 0 }}>組織を編集</h2>

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

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label
              htmlFor="name"
              style={{ display: 'block', marginBottom: '0.5rem', color: '#a1a1aa' }}
            >
              組織名 *
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '0.5rem',
                background: '#18181b',
                border: '1px solid #3f3f46',
                borderRadius: '4px',
                color: 'white',
              }}
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label
              htmlFor="slug"
              style={{ display: 'block', marginBottom: '0.5rem', color: '#a1a1aa' }}
            >
              スラッグ（任意）
            </label>
            <input
              id="slug"
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="例: acme-corp"
              style={{
                width: '100%',
                padding: '0.5rem',
                background: '#18181b',
                border: '1px solid #3f3f46',
                borderRadius: '4px',
                color: 'white',
              }}
            />
            <p style={{ fontSize: '0.75rem', color: '#71717a', marginTop: '0.25rem' }}>
              半角英数字とハイフンのみ使用可能
            </p>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label
              htmlFor="plan"
              style={{ display: 'block', marginBottom: '0.5rem', color: '#a1a1aa' }}
            >
              プラン *
            </label>
            <select
              id="plan"
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '0.5rem',
                background: '#18181b',
                border: '1px solid #3f3f46',
                borderRadius: '4px',
                color: 'white',
              }}
            >
              <option value="free">Free</option>
              <option value="starter">Starter</option>
              <option value="business">Business</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                style={{ marginRight: '0.5rem' }}
              />
              <span style={{ color: '#a1a1aa' }}>組織を有効化</span>
            </label>
            <p style={{ fontSize: '0.75rem', color: '#71717a', marginTop: '0.25rem' }}>
              無効化すると、この組織のメンバーはアクセスできなくなります
            </p>
          </div>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                padding: '0.5rem 1rem',
                background: '#3f3f46',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '0.875rem',
              }}
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '0.5rem 1rem',
                background: loading ? '#1e40af' : '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '0.875rem',
              }}
            >
              {loading ? '更新中...' : '更新'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
