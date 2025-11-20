'use server';

/**
 * 組織編集・削除のServer Actions
 *
 * 責務:
 * - 組織情報の更新
 * - 組織の削除（メンバー数チェック付き）
 * - 活動ログの記録
 */

import { isOpsUser } from '@repo/config';
import { getSupabaseAdmin } from '@repo/db';

interface ActionResult {
  success: boolean;
  error?: string;
  nextUrl?: string;
}

/**
 * 組織情報を更新
 */
export async function updateOrganization(
  orgId: string,
  name: string,
  slug: string | null,
  plan: string,
  isActive: boolean
): Promise<ActionResult> {
  // ops権限チェック
  const hasOpsPermission = await isOpsUser();
  if (!hasOpsPermission) {
    return { success: false, error: 'ops権限が必要です' };
  }

  // バリデーション
  if (!name || name.trim().length === 0) {
    return { success: false, error: '組織名は必須です' };
  }

  if (!orgId) {
    return { success: false, error: '組織IDが不正です' };
  }

  const supabaseAdmin = getSupabaseAdmin();

  // スラッグの重複チェック（変更時のみ）
  if (slug) {
    const { data: existingOrg } = await supabaseAdmin
      .from('organizations')
      .select('id')
      .eq('slug', slug)
      .neq('id', orgId)
      .single();

    if (existingOrg) {
      return { success: false, error: 'このスラッグは既に使用されています' };
    }
  }

  // 組織情報を更新
  const { error: updateError } = await supabaseAdmin
    .from('organizations')
    .update({
      name: name.trim(),
      slug: slug?.trim() || null,
      plan,
      is_active: isActive,
    })
    .eq('id', orgId);

  if (updateError) {
    console.error('[updateOrganization] Failed to update:', updateError);
    return { success: false, error: '組織の更新に失敗しました' };
  }

  // 活動ログを記録
  await supabaseAdmin.from('activity_logs').insert({
    org_id: orgId,
    user_id: null, // ops操作のためnull
    action: 'org.updated',
    details: {
      org_id: orgId,
      updated_fields: { name, slug, plan, is_active: isActive },
    },
  });

  return { success: true };
}

/**
 * 組織を削除
 */
export async function deleteOrganization(orgId: string): Promise<ActionResult> {
  // ops権限チェック
  const hasOpsPermission = await isOpsUser();
  if (!hasOpsPermission) {
    return { success: false, error: 'ops権限が必要です' };
  }

  if (!orgId) {
    return { success: false, error: '組織IDが不正です' };
  }

  const supabaseAdmin = getSupabaseAdmin();

  // メンバー数チェック
  const { count: memberCount } = await supabaseAdmin
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId);

  if (memberCount && memberCount > 0) {
    return {
      success: false,
      error: `メンバーが${memberCount}人存在するため削除できません。先にメンバーを削除してください。`,
    };
  }

  // 組織情報を取得（ログ用）
  const { data: org } = await supabaseAdmin
    .from('organizations')
    .select('name, slug')
    .eq('id', orgId)
    .single();

  // 活動ログを記録（削除前に記録）
  await supabaseAdmin.from('activity_logs').insert({
    org_id: orgId,
    user_id: null, // ops操作のためnull
    action: 'org.deleted',
    details: {
      org_id: orgId,
      org_name: org?.name,
      org_slug: org?.slug,
    },
  });

  // 組織を削除
  const { error: deleteError } = await supabaseAdmin
    .from('organizations')
    .delete()
    .eq('id', orgId);

  if (deleteError) {
    console.error('[deleteOrganization] Failed to delete:', deleteError);
    return { success: false, error: '組織の削除に失敗しました' };
  }

  return { success: true };
}
