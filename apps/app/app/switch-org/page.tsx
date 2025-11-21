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

import { createServerClient, getSupabaseAdmin } from '@repo/db';
import { getCurrentOrg } from '@repo/config';
import SwitchOrgForm from './switch-org-form';

export default async function SwitchOrgPage() {
  const supabase = await createServerClient();

  // 1. 現在のユーザーを取得
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>認証が必要です</p>
      </div>
    );
  }

  const userId = user.id;

  // 2. ユーザーが所属する組織一覧を取得
  // 注: Admin クライアントを使用することで、RLS ポリシーをバイパスして
  //     ユーザー自身の全ての組織プロファイルを取得できる
  //     （セキュリティ上問題なし: 自分自身の情報のみ取得）
  const adminSupabase = getSupabaseAdmin();

  // まずprofilesを取得
  const { data: profiles, error: profilesError } = await adminSupabase
    .from('profiles')
    .select('org_id, role')
    .eq('user_id', userId);

  if (profilesError) {
    console.error('[SwitchOrgPage] Failed to fetch profiles:', profilesError);
    return (
      <div style={{ padding: '2rem', textAlign: 'center', maxWidth: '600px', margin: '0 auto' }}>
        <h1 style={{ marginBottom: '1rem' }}>エラーが発生しました</h1>
        <p>組織情報の取得に失敗しました。</p>
      </div>
    );
  }

  if (!profiles || profiles.length === 0) {
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

  // 組織IDのリストを取得
  const orgIds = profiles.map(p => p.org_id);

  // 組織情報を別途取得
  const { data: organizations, error: orgsError } = await adminSupabase
    .from('organizations')
    .select('id, name')
    .in('id', orgIds);

  if (orgsError || !organizations) {
    console.error('[SwitchOrgPage] Failed to fetch organizations:', orgsError);
    return (
      <div style={{ padding: '2rem', textAlign: 'center', maxWidth: '600px', margin: '0 auto' }}>
        <h1 style={{ marginBottom: '1rem' }}>エラーが発生しました</h1>
        <p>組織情報の取得に失敗しました。</p>
      </div>
    );
  }

  // 3. 組織データを整形（profilesとorganizationsをマージ）
  const userOrganizations = profiles
    .map(p => {
      const org = organizations.find(o => o.id === p.org_id);
      return org ? {
        id: org.id,
        name: org.name,
        role: p.role,
      } : null;
    })
    .filter((org): org is { id: string; name: string; role: string } => org !== null);

  // 4. 現在の組織を取得
  const org = await getCurrentOrg();

  return (
    <div style={{ padding: '2rem' }}>
      <h1>組織切替</h1>

      {org && (
        <section style={{ marginTop: '2rem' }}>
          <h2>現在の組織</h2>
          <p>
            <strong data-testid="current-org">{org.orgName}</strong> ({org.orgId})
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
