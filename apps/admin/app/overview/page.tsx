/**
 * admin ドメイン: /overview
 *
 * 責務:
 * - 組織の概要・サマリを表示
 * - admin と owner がアクセス可能
 *
 * アクセス制御:
 * - member は middlewareで 403 を返す想定
 * - このページに到達した時点で admin 以上の権限があることが保証されている
 */

import { getCurrentOrg, getCurrentRole } from '@repo/config';
import { notFound } from 'next/navigation';

export default async function OverviewPage() {
  const org = await getCurrentOrg();
  const roleContext = await getCurrentRole();
  const role = roleContext?.role;

  // ADMIN domain: admin/owner のみアクセス可能
  if (!role || (role !== 'admin' && role !== 'owner')) {
    notFound();
  }

  // TODO: 実際にはSupabaseから組織情報を取得
  const orgDetails = {
    id: org?.orgId ?? 'unknown',
    name: org?.orgName ?? 'unknown',
    plan: 'Business',
    isActive: true,
    createdAt: '2024-01-01',
    memberCount: 15,
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h1>組織概要</h1>

      <section style={{ marginTop: '2rem' }}>
        <h2>現在のコンテキスト</h2>
        <p>あなたのロール: <strong>{role ?? 'unknown'}</strong></p>
      </section>

      <section style={{ marginTop: '2rem' }}>
        <h2>組織情報</h2>
        <dl style={{ lineHeight: '1.8' }}>
          <dt><strong>組織名:</strong></dt>
          <dd>{orgDetails.name}</dd>
          <dt><strong>組織ID:</strong></dt>
          <dd><code>{orgDetails.id}</code></dd>
          <dt><strong>プラン:</strong></dt>
          <dd>{orgDetails.plan}</dd>
          <dt><strong>状態:</strong></dt>
          <dd>
            <span style={{
              padding: '0.25rem 0.5rem',
              background: orgDetails.isActive ? '#10b981' : '#ef4444',
              color: 'white',
              borderRadius: '4px',
              fontSize: '0.875rem',
            }}>
              {orgDetails.isActive ? 'アクティブ' : '非アクティブ'}
            </span>
          </dd>
          <dt><strong>作成日:</strong></dt>
          <dd>{orgDetails.createdAt}</dd>
          <dt><strong>メンバー数:</strong></dt>
          <dd>{orgDetails.memberCount}人</dd>
        </dl>
      </section>

      <section style={{ marginTop: '2rem', padding: '1rem', background: '#fef3c7', borderRadius: '4px' }}>
        <h3 style={{ margin: 0 }}>admin ドメインについて</h3>
        <p style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>
          このドメインは組織管理・請求・リスク領域を扱います。
        </p>
        <ul style={{ fontSize: '0.875rem' }}>
          <li><strong>admin権限:</strong> ユーザー管理（CRUD、ロール変更: member/admin）</li>
          <li><strong>owner権限:</strong> 上記に加えて、支払い情報変更・組織凍結/廃止・owner譲渡</li>
        </ul>
        <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
          これらの操作は activity_logs に必ず記録されます。
        </p>
      </section>
    </div>
  );
}
