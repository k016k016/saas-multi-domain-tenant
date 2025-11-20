/**
 * ops ドメイン: /orgs
 *
 * 責務:
 * - 全組織の一覧を表示
 * - 組織の編集・削除機能
 *
 * 権限:
 * - opsのみアクセス可能
 */

import { isOpsUser } from '@repo/config';
import { getSupabaseAdmin } from '@repo/db';
import { notFound } from 'next/navigation';
import OrgsPageClient from './orgs-page-client';

// cookies()を使用するため、動的レンダリングを強制
export const dynamic = 'force-dynamic';

interface Organization {
  id: string;
  name: string;
  slug: string | null;
  plan: string;
  is_active: boolean;
  created_at: string;
  member_count: number;
}

export default async function OrgsPage() {
  // ops権限チェック
  const hasOpsPermission = await isOpsUser();

  if (!hasOpsPermission) {
    notFound();
  }

  // 全組織を取得
  const supabaseAdmin = getSupabaseAdmin();
  const { data: orgsData, error: orgsError } = await supabaseAdmin
    .from('organizations')
    .select('id, name, slug, plan, is_active, created_at')
    .order('created_at', { ascending: false });

  if (orgsError) {
    console.error('[OrgsPage] Failed to fetch organizations:', orgsError);
  }

  // 各組織のメンバー数を取得
  const organizations: Organization[] = await Promise.all(
    (orgsData || []).map(async (org) => {
      const { count } = await supabaseAdmin
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', org.id);

      return {
        id: org.id,
        name: org.name,
        slug: org.slug,
        plan: org.plan || 'free',
        is_active: org.is_active ?? true,
        created_at: new Date(org.created_at).toLocaleDateString('ja-JP'),
        member_count: count || 0,
      };
    })
  );

  return <OrgsPageClient organizations={organizations} />;
}
