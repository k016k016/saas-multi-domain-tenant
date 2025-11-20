'use client';

/**
 * 新規組織作成フォーム（Client Component）
 *
 * 責務:
 * - 組織名、スラッグ、ownerユーザー情報の入力
 * - Server Actionを呼び出して組織を作成
 * - 成功時に組織一覧ページへリダイレクト
 */

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createOrganization } from './actions';

export default function NewOrganizationForm() {
  const router = useRouter();
  const [orgName, setOrgName] = useState('');
  const [orgSlug, setOrgSlug] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [ownerPasswordConfirm, setOwnerPasswordConfirm] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSlugChange = (value: string) => {
    // 小文字に変換し、英数字とハイフンのみ許可
    const sanitized = value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setOrgSlug(sanitized);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // パスワードの確認チェック
    if (ownerPassword !== ownerPasswordConfirm) {
      setError('パスワードが一致しません');
      return;
    }

    setIsLoading(true);

    try {
      const result = await createOrganization(
        orgName,
        orgSlug,
        ownerEmail,
        ownerPassword,
        ownerName
      );

      if (result.success) {
        router.push(result.nextUrl || '/');
        router.refresh();
      } else {
        setError(result.error || '組織の作成に失敗しました');
      }
    } catch (err) {
      setError('組織の作成に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: '600px' }}>
      {error && (
        <div
          style={{
            padding: '0.75rem',
            marginBottom: '1.5rem',
            background: '#7f1d1d',
            border: '1px solid #ef4444',
            borderRadius: '4px',
            color: '#fca5a5',
            fontSize: '0.875rem',
          }}
        >
          {error}
        </div>
      )}

      {/* 組織情報 */}
      <fieldset
        style={{
          border: '1px solid #404040',
          borderRadius: '4px',
          padding: '1.5rem',
          marginBottom: '1.5rem',
        }}
      >
        <legend style={{ padding: '0 0.5rem', fontWeight: 'bold' }}>組織情報</legend>

        {/* 組織名 */}
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="org-name" style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
            組織名 <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <input
            id="org-name"
            type="text"
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            disabled={isLoading}
            required
            placeholder="Acme Corporation"
            style={{
              width: '100%',
              padding: '0.5rem',
              background: '#262626',
              color: '#e5e5e5',
              border: '1px solid #404040',
              borderRadius: '4px',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* スラッグ */}
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="org-slug" style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
            スラッグ（サブドメイン用） <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <input
            id="org-slug"
            type="text"
            value={orgSlug}
            onChange={(e) => handleSlugChange(e.target.value)}
            disabled={isLoading}
            required
            placeholder="acme"
            pattern="^[a-z0-9-]+$"
            style={{
              width: '100%',
              padding: '0.5rem',
              background: '#262626',
              color: '#e5e5e5',
              border: '1px solid #404040',
              borderRadius: '4px',
              boxSizing: 'border-box',
            }}
          />
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', color: '#a1a1aa' }}>
            例: acme → acme.app.example.com（英小文字、数字、ハイフンのみ）
          </p>
        </div>
      </fieldset>

      {/* ownerユーザー情報 */}
      <fieldset
        style={{
          border: '1px solid #404040',
          borderRadius: '4px',
          padding: '1.5rem',
          marginBottom: '1.5rem',
        }}
      >
        <legend style={{ padding: '0 0.5rem', fontWeight: 'bold' }}>Owner情報</legend>

        {/* 氏名 */}
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="owner-name" style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
            氏名 <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <input
            id="owner-name"
            type="text"
            value={ownerName}
            onChange={(e) => setOwnerName(e.target.value)}
            disabled={isLoading}
            required
            placeholder="山田 太郎"
            style={{
              width: '100%',
              padding: '0.5rem',
              background: '#262626',
              color: '#e5e5e5',
              border: '1px solid #404040',
              borderRadius: '4px',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* メールアドレス */}
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="owner-email" style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
            メールアドレス <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <input
            id="owner-email"
            type="email"
            value={ownerEmail}
            onChange={(e) => setOwnerEmail(e.target.value)}
            disabled={isLoading}
            required
            placeholder="owner@acme.com"
            style={{
              width: '100%',
              padding: '0.5rem',
              background: '#262626',
              color: '#e5e5e5',
              border: '1px solid #404040',
              borderRadius: '4px',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* パスワード */}
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="owner-password" style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
            パスワード <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <input
            id="owner-password"
            type="password"
            value={ownerPassword}
            onChange={(e) => setOwnerPassword(e.target.value)}
            disabled={isLoading}
            required
            minLength={6}
            placeholder="6文字以上"
            style={{
              width: '100%',
              padding: '0.5rem',
              background: '#262626',
              color: '#e5e5e5',
              border: '1px solid #404040',
              borderRadius: '4px',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* パスワード確認 */}
        <div style={{ marginBottom: '1rem' }}>
          <label
            htmlFor="owner-password-confirm"
            style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}
          >
            パスワード（確認） <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <input
            id="owner-password-confirm"
            type="password"
            value={ownerPasswordConfirm}
            onChange={(e) => setOwnerPasswordConfirm(e.target.value)}
            disabled={isLoading}
            required
            minLength={6}
            placeholder="パスワードを再入力"
            style={{
              width: '100%',
              padding: '0.5rem',
              background: '#262626',
              color: '#e5e5e5',
              border: '1px solid #404040',
              borderRadius: '4px',
              boxSizing: 'border-box',
            }}
          />
        </div>
      </fieldset>

      {/* ボタン */}
      <div style={{ display: 'flex', gap: '1rem' }}>
        <button
          type="submit"
          disabled={isLoading}
          style={{
            padding: '0.75rem 1.5rem',
            background: isLoading ? '#404040' : '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            fontSize: '1rem',
            fontWeight: 'bold',
          }}
        >
          {isLoading ? '作成中...' : '組織を作成'}
        </button>

        <button
          type="button"
          onClick={() => router.back()}
          disabled={isLoading}
          style={{
            padding: '0.75rem 1.5rem',
            background: 'transparent',
            color: '#a1a1aa',
            border: '1px solid #404040',
            borderRadius: '4px',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            fontSize: '1rem',
          }}
        >
          キャンセル
        </button>
      </div>
    </form>
  );
}
