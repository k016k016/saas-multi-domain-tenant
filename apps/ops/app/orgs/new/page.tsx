/**
 * ops ドメイン: /orgs/new
 *
 * 責務:
 * - システム管理者が新しい組織とownerを作成する
 * - 組織名、スラッグ、ownerの情報を入力
 * - サブドメインルーティング用のslugを指定
 *
 * 権限:
 * - ops管理者のみアクセス可能
 */

import { isOpsUser } from '@repo/config';
import { notFound } from 'next/navigation';
import NewOrganizationForm from './new-organization-form';

// cookies()を使用するため、動的レンダリングを強制
export const dynamic = 'force-dynamic';

export default async function NewOrganizationPage() {
  // ops権限チェック
  const hasOpsPermission = await isOpsUser();

  if (!hasOpsPermission) {
    notFound();
  }

  return (
    <div style={{ padding: '2rem' }}>
      <header style={{ marginBottom: '2rem' }}>
        <h1>New Organization / 新規組織作成</h1>
        <p style={{ color: '#a1a1aa', marginTop: '0.5rem' }}>
          新しい組織とその組織のownerユーザーを作成します
        </p>
      </header>

      <NewOrganizationForm />

      {/* 注意書き */}
      <section
        style={{
          marginTop: '2rem',
          padding: '1rem',
          background: '#422006',
          border: '1px solid #92400e',
          borderRadius: '4px',
          color: '#fdba74',
        }}
      >
        <h3 style={{ marginTop: 0, color: '#f97316' }}>⚠️ 注意事項</h3>
        <ul style={{ margin: 0, paddingLeft: '1.5rem' }}>
          <li>スラッグは英小文字、数字、ハイフンのみ使用できます</li>
          <li>スラッグは組織のサブドメインとして使用されます（例: acme.app.example.com）</li>
          <li>予約語（www, app, admin, ops, api, static, assets）は使用できません</li>
          <li>ownerは組織の最高権限を持つユーザーです</li>
          <li>ownerは削除できません（譲渡のみ可能）</li>
        </ul>
      </section>
    </div>
  );
}
