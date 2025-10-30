/**
 * admin ドメイン: /org-settings
 *
 * 責務:
 * - owner専用の組織設定UI
 * - 支払い情報の変更
 * - 組織の凍結 / 廃止（状態遷移）
 * - admin権限の付け替え
 * - owner権限の譲渡
 *
 * アクセス制御:
 * - owner のみアクセス可能
 * - admin は 403 を返す想定（middlewareで制御）
 *
 * 監査ログ:
 * - これらすべての操作は activity_logs に必ず記録する
 * - action: 'payment_updated' / 'org_suspended' / 'org_closed' / 'owner_transferred' 等
 *
 * 禁止事項:
 * - これらの機能を app ドメインに配置することは絶対に禁止
 */

import { getCurrentOrg, getCurrentRole } from '@repo/config';

export default async function OrgSettingsPage() {
  const org = await getCurrentOrg();
  const roleContext = await getCurrentRole();
  const role = roleContext?.role;

  // owner専用ページであることを明示
  // TODO: 実際にはmiddlewareでロールチェック済み
  const isOwner = role === 'owner';

  return (
    <div style={{ padding: '2rem' }}>
      <h1>組織設定 (Owner専用)</h1>

      {!isOwner && (
        <section style={{ marginTop: '2rem', padding: '1rem', background: '#fee2e2', borderRadius: '4px' }}>
          <h3 style={{ margin: 0, color: '#dc2626' }}>アクセス拒否</h3>
          <p style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>
            このページはowner専用です。adminはアクセスできません。
          </p>
        </section>
      )}

      {isOwner && (
        <>
          <section style={{ marginTop: '2rem' }}>
            <h2>現在のコンテキスト</h2>
            <p>組織: <strong>{org?.orgName ?? 'unknown'}</strong></p>
            <p>あなたのロール: <strong>{role}</strong></p>
          </section>

          {/* 支払い情報の変更 */}
          <section style={{ marginTop: '2rem', padding: '1.5rem', border: '1px solid #ddd', borderRadius: '4px' }}>
            <h3>支払い情報の変更</h3>
            <p style={{ fontSize: '0.875rem', color: '#666' }}>
              クレジットカード情報、請求先住所などを変更できます。
            </p>
            <button
              style={{
                marginTop: '1rem',
                padding: '0.5rem 1rem',
                background: '#0070f3',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              支払い情報を編集
            </button>
            <p style={{ fontSize: '0.75rem', color: '#999', marginTop: '0.5rem' }}>
              ※ この操作は activity_logs に記録されます (action='payment_updated')
            </p>
          </section>

          {/* 組織の凍結 / 廃止 */}
          <section style={{ marginTop: '2rem', padding: '1.5rem', border: '1px solid #dc2626', borderRadius: '4px', background: '#fef2f2' }}>
            <h3 style={{ color: '#dc2626' }}>組織の凍結 / 廃止</h3>
            <p style={{ fontSize: '0.875rem', color: '#666' }}>
              組織を一時的に凍結（is_active=false）、または完全に廃止できます。
            </p>
            <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem' }}>
              <button
                style={{
                  padding: '0.5rem 1rem',
                  background: '#f59e0b',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                組織を凍結
              </button>
              <button
                style={{
                  padding: '0.5rem 1rem',
                  background: '#dc2626',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                組織を廃止
              </button>
            </div>
            <p style={{ fontSize: '0.75rem', color: '#999', marginTop: '0.5rem' }}>
              ※ これらの操作は activity_logs に記録されます (action='org_suspended' / 'org_closed')
            </p>
          </section>

          {/* admin権限の付け替え */}
          <section style={{ marginTop: '2rem', padding: '1.5rem', border: '1px solid #ddd', borderRadius: '4px' }}>
            <h3>admin権限の付け替え</h3>
            <p style={{ fontSize: '0.875rem', color: '#666' }}>
              メンバーにadmin権限を付与、またはadminからmemberに降格できます。
            </p>
            <button
              style={{
                marginTop: '1rem',
                padding: '0.5rem 1rem',
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              ユーザー管理へ
            </button>
            <p style={{ fontSize: '0.75rem', color: '#999', marginTop: '0.5rem' }}>
              ※ この操作は activity_logs に記録されます (action='user_role_changed')
            </p>
          </section>

          {/* owner権限の譲渡 */}
          <section style={{ marginTop: '2rem', padding: '1.5rem', border: '2px solid #dc2626', borderRadius: '4px', background: '#fef2f2' }}>
            <h3 style={{ color: '#dc2626' }}>owner権限の譲渡</h3>
            <p style={{ fontSize: '0.875rem', color: '#666' }}>
              新しいownerを指名し、自分は降格します。各組織にownerは必ず1人必要です。
            </p>
            <p style={{ fontSize: '0.875rem', color: '#dc2626', fontWeight: 'bold', marginTop: '0.5rem' }}>
              ⚠️ この操作は取り消せません
            </p>
            <button
              style={{
                marginTop: '1rem',
                padding: '0.5rem 1rem',
                background: '#dc2626',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              owner権限を譲渡
            </button>
            <p style={{ fontSize: '0.75rem', color: '#999', marginTop: '0.5rem' }}>
              ※ この操作は activity_logs に記録されます (action='owner_transferred', payload={'{ old_owner_id, new_owner_id }'})
            </p>
          </section>

          <section style={{ marginTop: '2rem', padding: '1rem', background: '#fef3c7', borderRadius: '4px' }}>
            <h3 style={{ margin: 0 }}>重要な注意事項</h3>
            <ul style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
              <li>これらの操作はすべて activity_logs に記録されます</li>
              <li>ownerは各組織に必ず1人で、削除不可です</li>
              <li>owner交代は「譲渡」のみで可能（新オーナー指名→元オーナー降格）</li>
              <li><strong>これらの機能を app ドメインに配置することは絶対に禁止されています</strong></li>
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
