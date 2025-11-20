/**
 * ops ドメイン: /orgs/[orgId]
 *
 * 責務:
 * - 指定組織の詳細情報を表示
 * - その組織のメンバー一覧を表示
 * - メンバーの招待・編集・削除
 * - メンバーのパスワード変更
 *
 * 権限:
 * - opsのみアクセス可能
 */

import { isOpsUser } from '@repo/config';
import { getSupabaseAdmin } from '@repo/db';
import { notFound } from 'next/navigation';
import OrgMembersPageClient from './org-members-page-client';

// cookies()を使用するため、動的レンダリングを強制
export const dynamic = 'force-dynamic';

interface Member {
  userId: string;
  email: string;
  name: string;
  role: 'owner' | 'admin' | 'member';
  status: 'active';
  createdAt: string;
}

export default async function OrgMembersPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  // ops権限チェック
  const hasOpsPermission = await isOpsUser();

  if (!hasOpsPermission) {
    notFound();
  }

  const { orgId } = await params;

  // 組織情報を取得
  const supabaseAdmin = getSupabaseAdmin();
  const { data: org, error: orgError } = await supabaseAdmin
    .from('organizations')
    .select('id, name, slug, plan, is_active')
    .eq('id', orgId)
    .single();

  if (orgError || !org) {
    console.error('[OrgMembersPage] Failed to fetch organization:', orgError);
    notFound();
  }

  // 組織のメンバー一覧を取得
  const { data: profilesData, error: profilesError } = await supabaseAdmin
    .from('profiles')
    .select('user_id, role, created_at')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  if (profilesError) {
    console.error('[OrgMembersPage] Failed to fetch profiles:', profilesError);
  }

  // auth.usersテーブルからメールアドレスと氏名を取得
  const { data: usersData, error: usersError } = await supabaseAdmin.auth.admin.listUsers();

  if (usersError) {
    console.error('[OrgMembersPage] Failed to fetch users:', usersError);
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
  const members: Member[] =
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
    <OrgMembersPageClient
      org={{
        orgId: org.id,
        orgName: org.name,
        slug: org.slug,
        plan: org.plan,
        isActive: org.is_active,
      }}
      members={members}
    />
  );
}
