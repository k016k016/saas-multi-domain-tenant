/**
 * ops ドメイン: /
 *
 * 責務:
 * - 事業者側（SaaS提供者）の内部コンソール領域
 * - ops ロールのみアクセス可能
 *
 * 実装方針:
 * - 今回の雛形では機能自体は実装しない
 * - "internal only / ops only" と明記したダミーページのみ
 *
 * 将来的な用途例:
 * - 全組織の一覧・統計
 * - サポートチケット管理
 * - システム設定
 */

import { getCurrentRole } from '@repo/config';
import { notFound } from 'next/navigation';

// cookies()を使用するため、動的レンダリングを強制
export const dynamic = 'force-dynamic';

export default async function OpsHomePage() {
  const roleContext = await getCurrentRole();
  const role = roleContext?.role;

  // OPS domain: ops のみアクセス可能
  if (!role || role !== 'ops') {
    notFound();
  }

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Ops コンソール</h1>

      <section style={{ marginTop: '2rem', padding: '2rem', border: '2px solid #6366f1', borderRadius: '4px', background: '#1e1b4b', textAlign: 'center' }}>
        <h2 style={{ color: '#a5b4fc' }}>Internal Only / Ops Only</h2>
        <p style={{ marginTop: '1rem', fontSize: '0.875rem', color: '#c7d2fe' }}>
          このドメインは事業者側（SaaS提供者）の内部コンソール領域です。
        </p>
        <p style={{ fontSize: '0.875rem', color: '#c7d2fe' }}>
          現在のロール: <strong>{role}</strong>
        </p>
      </section>

      <section style={{ marginTop: '2rem' }}>
        <h2>将来的な機能例</h2>
        <ul style={{ lineHeight: '1.8' }}>
          <li>全組織の一覧・統計</li>
          <li>サポートチケット管理</li>
          <li>システム設定・メンテナンス</li>
          <li>課金・請求の管理</li>
        </ul>
      </section>

      <section style={{ marginTop: '2rem', padding: '1rem', background: '#422006', border: '1px solid #92400e', borderRadius: '4px' }}>
        <h3 style={{ margin: 0, color: '#fbbf24' }}>注意</h3>
        <p style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#fde68a' }}>
          今回の雛形では、機能自体は実装していません。
          このダミーページのみで、実際の機能は将来実装する想定です。
        </p>
      </section>
    </div>
  );
}
