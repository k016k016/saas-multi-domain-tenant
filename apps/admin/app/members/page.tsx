/**
 * admin ドメイン: /members
 *
 * 責務:
 * - 組織内ユーザー管理UI
 * - admin: ユーザーCRUD、ロール変更（member/admin）が可能
 * - owner: 上記に加えて、admin権限の付け替え、owner譲渡が可能
 *
 * アクセス制御:
 * - admin と owner のみアクセス可能
 * - member は middlewareで 403
 *
 * 監査ログ:
 * - ユーザーのCRUD操作は activity_logs に記録
 * - ロール変更も activity_logs に記録
 * - action: 'user_created' / 'user_updated' / 'user_role_changed' 等
 */

import { getCurrentOrg, getCurrentRole } from '@repo/config';

export default async function MembersPage() {
  const org = await getCurrentOrg();
  const { role } = await getCurrentRole();

  // TODO: 実際にはSupabaseから組織のユーザー一覧を取得
  const members = [
    { id: 'user_1', name: '山田太郎', email: 'yamada@example.com', role: 'owner' },
    { id: 'user_2', name: '佐藤花子', email: 'sato@example.com', role: 'admin' },
    { id: 'user_3', name: '鈴木一郎', email: 'suzuki@example.com', role: 'member' },
  ];

  return (
    <div style={{ padding: '2rem' }}>
      <h1>ユーザー管理</h1>

      <section style={{ marginTop: '2rem' }}>
        <h2>現在のコンテキスト</h2>
        <p>組織: <strong>{org.orgName}</strong></p>
        <p>あなたのロール: <strong>{role}</strong></p>
      </section>

      <section style={{ marginTop: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>メンバー一覧</h2>
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
            + ユーザー招待
          </button>
        </div>

        <table style={{ width: '100%', marginTop: '1rem', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f9fafb', borderBottom: '2px solid #ddd' }}>
              <th style={{ padding: '0.75rem', textAlign: 'left' }}>名前</th>
              <th style={{ padding: '0.75rem', textAlign: 'left' }}>メール</th>
              <th style={{ padding: '0.75rem', textAlign: 'left' }}>ロール</th>
              <th style={{ padding: '0.75rem', textAlign: 'left' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.id} style={{ borderBottom: '1px solid #ddd' }}>
                <td style={{ padding: '0.75rem' }}>{member.name}</td>
                <td style={{ padding: '0.75rem' }}>{member.email}</td>
                <td style={{ padding: '0.75rem' }}>
                  <span style={{
                    padding: '0.25rem 0.5rem',
                    background: member.role === 'owner' ? '#10b981' : member.role === 'admin' ? '#3b82f6' : '#6b7280',
                    color: 'white',
                    borderRadius: '4px',
                    fontSize: '0.875rem',
                  }}>
                    {member.role}
                  </span>
                </td>
                <td style={{ padding: '0.75rem' }}>
                  {member.role === 'owner' ? (
                    <span style={{ fontSize: '0.875rem', color: '#666' }}>削除不可</span>
                  ) : (
                    <button
                      style={{
                        padding: '0.25rem 0.5rem',
                        background: '#ef4444',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '0.875rem',
                        cursor: 'pointer',
                      }}
                    >
                      無効化
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section style={{ marginTop: '2rem', padding: '1rem', background: '#f0f9ff', borderRadius: '4px' }}>
        <h3 style={{ margin: 0 }}>権限について</h3>
        <ul style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
          <li><strong>admin権限:</strong> ユーザーのCRUD、ロール変更（member ⇔ admin）が可能</li>
          <li><strong>owner権限:</strong> 上記に加えて、admin権限の付け替え、owner譲渡が可能</li>
          <li><strong>owner削除:</strong> ownerは削除不可。owner交代は「譲渡」のみ許可（新オーナー指名→元オーナー降格）</li>
        </ul>
      </section>

      <section style={{ marginTop: '2rem', fontSize: '0.875rem', color: '#666', padding: '1rem', background: '#f9fafb', borderRadius: '4px' }}>
        <h3 style={{ margin: 0, fontSize: '1rem' }}>実装メモ</h3>
        <ul style={{ marginTop: '0.5rem' }}>
          <li>ユーザーのCRUD操作は activity_logs に記録: action='user_created' / 'user_updated' / 'user_disabled'</li>
          <li>ロール変更も activity_logs に記録: action='user_role_changed', payload={'{ user_id, old_role, new_role }'}</li>
          <li>Server Actionでは {'{ success, nextUrl }'} を返し、redirect() は使用しない</li>
          <li>RLSでorg_id単位のアクセス制御を徹底</li>
        </ul>
      </section>
    </div>
  );
}
