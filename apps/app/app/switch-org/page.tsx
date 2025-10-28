/**
 * app ドメイン: /switch-org
 *
 * 責務:
 * - ユーザーが所属する組織の中からアクティブな組織を切り替える
 *
 * 実装方針:
 * - Server Actionは org_id を受け取り、妥当性を検証する
 * - ユーザーが所属していないorg_idは拒否し、{ success: false, nextUrl: '/unauthorized' } を返す
 * - Server Action内で `redirect()` は禁止。返却オブジェクト { success, nextUrl } で返す
 * - 画面遷移はクライアント側で router.push(nextUrl) を使って行う
 *
 * 監査ログ:
 * - 組織切替は activity_logs に記録する必要がある
 * - action: 'org_switch'
 * - payload: { from_org_id, to_org_id }
 */

import { getCurrentOrg, getCurrentRole } from '@repo/config';

export default async function SwitchOrgPage() {
  const org = await getCurrentOrg();
  const { role } = await getCurrentRole();

  // TODO: 実際にはSupabaseからユーザーの所属組織一覧を取得
  const organizations = [
    { id: 'org_dummy_12345', name: 'サンプル組織A' },
    { id: 'org_dummy_67890', name: 'サンプル組織B' },
  ];

  return (
    <div style={{ padding: '2rem' }}>
      <h1>組織切り替え</h1>

      <section style={{ marginTop: '2rem' }}>
        <h2>現在の組織</h2>
        <p>
          <strong>{org.orgName}</strong> ({org.orgId})
        </p>
        <p>あなたのロール: <strong>{role}</strong></p>
      </section>

      <section style={{ marginTop: '2rem' }}>
        <h2>切り替え可能な組織</h2>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {organizations.map((o) => (
            <li
              key={o.id}
              style={{
                padding: '1rem',
                marginBottom: '0.5rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                background: o.id === org.orgId ? '#f0f9ff' : 'white',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong>{o.name}</strong>
                  <br />
                  <span style={{ fontSize: '0.875rem', color: '#666' }}>{o.id}</span>
                </div>
                {o.id === org.orgId ? (
                  <span style={{ color: '#0070f3', fontSize: '0.875rem' }}>現在の組織</span>
                ) : (
                  <button
                    style={{
                      padding: '0.5rem 1rem',
                      background: '#0070f3',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    切り替え
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section style={{ marginTop: '2rem', fontSize: '0.875rem', color: '#666', padding: '1rem', background: '#f9fafb', borderRadius: '4px' }}>
        <h3 style={{ margin: 0, fontSize: '1rem' }}>実装メモ</h3>
        <ul style={{ marginTop: '0.5rem' }}>
          <li>Server Actionで org_id の妥当性を検証</li>
          <li>ユーザーが所属していないorg_idは拒否し、{'{ success: false, nextUrl: \'/unauthorized\' }'} を返す</li>
          <li>Server Action内で redirect() は使用せず、返却オブジェクトで画面遷移先を指示</li>
          <li>クライアント側で router.push(nextUrl) を使って遷移</li>
          <li>組織切替は activity_logs に記録: action='org_switch', payload={'{ from_org_id, to_org_id }'}</li>
        </ul>
      </section>
    </div>
  );
}
