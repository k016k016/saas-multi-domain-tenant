/**
 * admin ドメイン: /o/[orgSlug]/members
 *
 * Phase 3: URL で org を指定（動的ルート版）
 *
 * 責務:
 * - URLのorgSlugパラメータから組織を解決
 * - 指定された組織のメンバー一覧を表示
 * - 新規ユーザーの招待
 * - メンバーのロール変更
 * - メンバーの削除/無効化
 *
 * 権限:
 * - adminとownerのみアクセス可能（ページレベルでチェック）
 * - ownerのロール変更・削除は禁止（Server Actionで制御）
 */

import { getCurrentOrg } from '@repo/config';
import { getSupabaseAdmin, createServerClient } from '@repo/db';
import { notFound, redirect } from 'next/navigation';
import MembersPageClient from '../../../members/members-page-client';

// cookies()を使用するため、動的レンダリングを強制
export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{
    orgSlug: string;
  }>;
}

export default async function MembersPageWithOrgSlug({ params }: PageProps) {
  // Next.js 15以降、paramsはPromiseとして渡される
  const { orgSlug } = await params;

  // orgSlugを指定してgetCurrentOrgを呼び出す
  const org = await getCurrentOrg({ orgSlug });

  if (!org) {
    notFound();
  }

  // この組織でのユーザーのロールを取得
  const supabase = await createServerClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.user) {
    redirect('/unauthorized');
  }

  const adminSupabase = getSupabaseAdmin();
  const { data: profile } = await adminSupabase
    .from('profiles')
    .select('role')
    .eq('user_id', session.user.id)
    .eq('org_id', org.orgId)
    .single();

  const currentUserRole = profile?.role as 'owner' | 'admin' | 'member' | undefined;

  // ADMIN domain: admin/owner のみアクセス可能
  if (!currentUserRole || (currentUserRole !== 'admin' && currentUserRole !== 'owner')) {
    redirect('/unauthorized');
  }

  // Supabase profilesテーブルから組織のメンバー一覧を取得（Service Role Key使用）
  const supabaseAdmin = getSupabaseAdmin();
  const { data: profilesData, error: profilesError } = await supabaseAdmin
    .from('profiles')
    .select('user_id, role, created_at')
    .eq('org_id', org.orgId)
    .order('created_at', { ascending: false });

  if (profilesError) {
    console.error('[MembersPageWithOrgSlug] Failed to fetch profiles:', profilesError);
  }

  // auth.usersテーブルからメールアドレスと氏名を取得
  const { data: usersData, error: usersError } = await supabaseAdmin.auth.admin.listUsers();

  if (usersError) {
    console.error('[MembersPageWithOrgSlug] Failed to fetch users:', usersError);
  }

  // user_idをキーにしたマップを作成
  const userMap = new Map<string, { email: string; name: string }>();
  usersData?.users?.forEach((user) => {
    userMap.set(user.id, {
      email: user.email || '',
      name: user.user_metadata?.name || '',
    });
  });

  // profilesとusersをマージしてメンバー一覧を作成
  const members =
    profilesData?.map((profile) => {
      const userInfo = userMap.get(profile.user_id);
      return {
        userId: profile.user_id,
        email: userInfo?.email || `${profile.user_id.substring(0, 8)}@...`,
        name: userInfo?.name || '',
        role: profile.role as 'owner' | 'admin' | 'member',
        status: 'active' as const,
        createdAt: new Date(profile.created_at).toLocaleDateString('ja-JP'),
      };
    }) || [];

  return (
    <MembersPageClient
      org={org}
      members={members}
      currentUserRole={currentUserRole}
    />
  );
}