/**
 * app ドメイン: /dashboard
 *
 * 責務:
 * - 日常業務のダッシュボード
 * - member/admin/owner すべてのロールがアクセス可能
 * - 現在のorg_idとroleを表示
 *
 * アクセス制御:
 * - middlewareでorg_idの妥当性が検証済みであることを前提とする
 * - ユーザーが所属していないorg_idの場合は401/403を返す
 *
 * 禁止事項:
 * - 支払い情報の変更
 * - 組織の凍結/廃止
 * - owner権限の譲渡
 * これらはadminドメインの /org-settings でのみ許可される
 */

import { getCurrentOrg, getCurrentRole } from '@repo/config';

export default async function DashboardPage() {
  const org = await getCurrentOrg();
  const { role } = await getCurrentRole();

  return (
    <div style={{ padding: '2rem' }}>
      <h1>ダッシュボード</h1>

      <section style={{ marginTop: '2rem' }}>
        <h2>現在のコンテキスト</h2>
        <dl style={{ lineHeight: '1.8' }}>
          <dt><strong>組織ID:</strong></dt>
          <dd>{org.orgId}</dd>
          <dt><strong>組織名:</strong></dt>
          <dd>{org.orgName}</dd>
          <dt><strong>あなたのロール:</strong></dt>
          <dd>
            <span style={{
              padding: '0.25rem 0.5rem',
              background: role === 'owner' ? '#10b981' : role === 'admin' ? '#3b82f6' : '#6b7280',
              color: 'white',
              borderRadius: '4px',
              fontSize: '0.875rem',
            }}>
              {role}
            </span>
          </dd>
        </dl>
      </section>

      <section style={{ marginTop: '2rem' }}>
        <h2>業務機能</h2>
        <p>ここに日常業務に必要な機能を配置します。</p>
        <ul>
          <li>データの登録・閲覧・更新</li>
          <li>自分のプロフィール編集</li>
          <li>組織の切り替え（/switch-org）</li>
        </ul>
      </section>

      <section style={{ marginTop: '2rem', padding: '1rem', background: '#422006', border: '1px solid #92400e', borderRadius: '4px' }}>
        <h3 style={{ margin: 0, color: '#fbbf24' }}>注意</h3>
        <p style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#fde68a' }}>
          このドメイン(app)では以下の操作は<strong>禁止</strong>されています:
        </p>
        <ul style={{ fontSize: '0.875rem', color: '#fde68a' }}>
          <li>支払い情報の変更</li>
          <li>組織の凍結 / 廃止</li>
          <li>owner権限の譲渡</li>
        </ul>
        <p style={{ fontSize: '0.875rem', marginTop: '0.5rem', color: '#fde68a' }}>
          これらはadminドメインの /org-settings (owner専用) でのみ許可されます。
        </p>
      </section>

      {(role === 'admin' || role === 'owner') && (
        <section style={{ marginTop: '2rem' }}>
          <h3>管理者向けリンク</h3>
          <a
            href={`${process.env.NEXT_PUBLIC_ADMIN_URL || 'http://admin.local.test:3003'}`}
            style={{
              display: 'inline-block',
              padding: '0.5rem 1rem',
              background: '#3b82f6',
              color: 'white',
              borderRadius: '4px',
              textDecoration: 'none',
            }}
          >
            Admin ドメインへ
          </a>
        </section>
      )}
    </div>
  );
}
