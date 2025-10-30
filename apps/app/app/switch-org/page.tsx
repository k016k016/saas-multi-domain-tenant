/**
 * app ドメイン: /switch-org
 *
 * 責務:
 * - ユーザーが所属する組織の一覧を表示
 * - 組織を切り替える（Server Actionを呼び出す）
 * - Server Actionの戻り値に従って遷移する
 *
 * 重要な設計方針:
 * - Server Actionはredirect()しない
 * - このClient ComponentがnextUrlに基づいて遷移する
 */

import { createServerClient } from '@repo/db';
import { getCurrentOrg } from '@repo/config';
import SwitchOrgForm from './switch-org-form';

export default async function SwitchOrgPage() {
  const supabase = createServerClient();

  // 1. 現在のユーザーを取得
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.user) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>認証が必要です</p>
      </div>
    );
  }

  const userId = session.user.id;

  // 2. ユーザーが所属する組織一覧を取得
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('org_id, role, organizations(id, name)')
    .eq('user_id', userId);

  if (error || !profiles || profiles.length === 0) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', maxWidth: '600px', margin: '0 auto' }}>
        <h1 style={{ marginBottom: '1rem' }}>組織が見つかりません</h1>
        <p>
          現在、どの組織にも所属していません。<br />
          組織の管理者に招待してもらってください。
        </p>
      </div>
    );
  }

  // 3. 組織データを整形
  const userOrganizations = profiles
    .filter(p => p.organizations)
    .map(p => ({
      id: p.organizations!.id,
      name: p.organizations!.name,
      role: p.role,
    }));

  // 4. 現在の組織を取得
  const org = await getCurrentOrg();

  return (
    <div style={{ padding: '2rem' }}>
      <h1>組織切替</h1>

      {org && (
        <section style={{ marginTop: '2rem' }}>
          <h2>現在の組織</h2>
          <p>
            <strong>{org.orgName}</strong> ({org.orgId})
          </p>
        </section>
      )}

      <section style={{ marginTop: '2rem' }}>
        <h2>切り替え先の組織を選択</h2>
        <SwitchOrgForm
          organizations={userOrganizations}
          currentOrgId={org?.orgId}
        />
      </section>

      <section style={{ marginTop: '2rem', padding: '1rem', background: '#422006', border: '1px solid #92400e', borderRadius: '4px' }}>
        <h3 style={{ margin: 0, color: '#fbbf24' }}>注意</h3>
        <p style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#fde68a' }}>
          組織を切り替えると、現在のコンテキストが変更されます。
        </p>
        <p style={{ fontSize: '0.875rem', color: '#fde68a' }}>
          この操作はactivity_logsに記録されます（将来実装）。
        </p>
      </section>
    </div>
  );
}
