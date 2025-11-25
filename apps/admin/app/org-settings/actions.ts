/**
 * org-settings Server Actions
 *
 * 責務:
 * - owner権限譲渡
 * - 組織凍結・解除
 * - 組織廃止
 * - すべての操作で activity_logs に記録
 *
 * 権限:
 * - すべてのアクションは owner のみ実行可能
 */

'use server';

import { getCurrentOrg, getCurrentRole } from '@repo/config';
import { createServerClient, getSupabaseAdmin } from '@repo/db';
import { revalidatePath } from 'next/cache';

/**
 * owner権限譲渡
 *
 * - 新owner: admin/member → owner
 * - 旧owner: owner → admin
 * - activity_logs に記録
 *
 * @param newOwnerId 新ownerのユーザーID
 */
export async function transferOwnership(newOwnerId: string) {
  const supabase = await createServerClient();
  const org = await getCurrentOrg();
  const roleContext = await getCurrentRole();

  // owner権限チェック
  if (!roleContext || roleContext.role !== 'owner') {
    return { success: false, error: 'Forbidden: owner権限が必要です' };
  }

  if (!org) {
    return { success: false, error: '組織が見つかりません' };
  }

  // 現在のユーザーID取得
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: '認証エラー' };
  }

  const currentUserId = user.id;

  // 譲渡先が同一組織のメンバーか確認（RLS バイパスのため admin client を使用）
  const supabaseAdmin = getSupabaseAdmin();
  const { data: newOwnerProfile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('role, user_id')
    .eq('user_id', newOwnerId)
    .eq('org_id', org.orgId)
    .single();

  if (profileError || !newOwnerProfile) {
    return { success: false, error: '譲渡先ユーザーが組織内に見つかりません' };
  }

  // 自分自身への譲渡は不可
  if (newOwnerId === currentUserId) {
    return { success: false, error: '自分自身にowner権限を譲渡できません' };
  }

  // トランザクション的処理（順次実行）（RLS バイパスのため admin client を使用）
  // 順序重要: 先に旧owner降格 → 新owner昇格（1組織1owner制約のため）

  // 1. 自分を admin に降格
  const { error: downgradeError } = await supabaseAdmin
    .from('profiles')
    .update({ role: 'admin' })
    .eq('user_id', currentUserId)
    .eq('org_id', org.orgId);

  if (downgradeError) {
    console.error('[transferOwnership] Failed to downgrade old owner:', downgradeError);
    return { success: false, error: '旧ownerの降格に失敗しました' };
  }

  // 2. 新ownerを owner に昇格
  const { error: upgradeError } = await supabaseAdmin
    .from('profiles')
    .update({ role: 'owner' })
    .eq('user_id', newOwnerId)
    .eq('org_id', org.orgId);

  if (upgradeError) {
    console.error('[transferOwnership] Failed to upgrade new owner:', upgradeError);
    // ロールバック: 自分を owner に戻す
    await supabaseAdmin
      .from('profiles')
      .update({ role: 'owner' })
      .eq('user_id', currentUserId)
      .eq('org_id', org.orgId);
    return { success: false, error: '新ownerの昇格に失敗しました' };
  }

  // 3. activity_logs に記録
  const { error: logError } = await supabase
    .from('activity_logs')
    .insert({
      org_id: org.orgId,
      user_id: currentUserId,
      action: 'org.ownership_transferred',
      payload: {
        old_owner_id: currentUserId,
        new_owner_id: newOwnerId,
        old_owner_role: 'owner',
        new_owner_old_role: newOwnerProfile.role,
      },
    });

  if (logError) {
    console.error('[transferOwnership] Failed to log activity:', logError);
  }

  return { success: true, nextUrl: '/members' };
}

/**
 * 組織凍結
 *
 * - organizations.is_active = false
 * - activity_logs に記録
 *
 * @param reason 凍結理由
 */
export async function freezeOrganization(reason: string) {
  const supabase = await createServerClient();
  const org = await getCurrentOrg();
  const roleContext = await getCurrentRole();

  // owner権限チェック
  if (!roleContext || roleContext.role !== 'owner') {
    return { success: false, error: 'Forbidden: owner権限が必要です' };
  }

  if (!org) {
    return { success: false, error: '組織が見つかりません' };
  }

  // 現在のユーザーID取得
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: '認証エラー' };
  }

  // 組織を凍結（RLS バイパスのため admin client を使用）
  console.log('[freezeOrganization] Updating organizations table...');
  console.log('[freezeOrganization] Target org ID:', org.orgId);
  const supabaseAdmin = getSupabaseAdmin();

  // 更新前の状態を確認
  const { data: beforeData } = await supabaseAdmin
    .from('organizations')
    .select('is_active, updated_at')
    .eq('id', org.orgId)
    .single();
  console.log('[freezeOrganization] BEFORE update:', JSON.stringify(beforeData));

  const { error: freezeError } = await supabaseAdmin
    .from('organizations')
    .update({ is_active: false })
    .eq('id', org.orgId);

  if (freezeError) {
    console.error('[freezeOrganization] Failed to freeze organization:', freezeError);
    return { success: false, error: '組織の凍結に失敗しました' };
  }

  // 更新後の状態を確認
  const { data: afterData } = await supabaseAdmin
    .from('organizations')
    .select('is_active, updated_at')
    .eq('id', org.orgId)
    .single();
  console.log('[freezeOrganization] Organizations table updated successfully');
  console.log('[freezeOrganization] AFTER update (separate query):', JSON.stringify(afterData));

  // activity_logs に記録
  const { error: logError } = await supabase
    .from('activity_logs')
    .insert({
      org_id: org.orgId,
      user_id: user.id,
      action: 'org.frozen',
      payload: {
        reason,
        frozen_by: 'owner',
      },
    });

  if (logError) {
    console.error('[freezeOrganization] Failed to log activity:', logError);
  }

  revalidatePath('/org-settings');
  return { success: true };
}

/**
 * 凍結解除
 *
 * - organizations.is_active = true
 * - activity_logs に記録
 */
export async function unfreezeOrganization() {
  console.log('[unfreezeOrganization] START');
  const supabase = await createServerClient();
  const org = await getCurrentOrg();
  const roleContext = await getCurrentRole();
  console.log('[unfreezeOrganization] org:', org?.orgId, 'role:', roleContext?.role);

  // owner権限チェック
  if (!roleContext || roleContext.role !== 'owner') {
    console.log('[unfreezeOrganization] Permission denied');
    return { success: false, error: 'Forbidden: owner権限が必要です' };
  }

  if (!org) {
    console.log('[unfreezeOrganization] Org not found');
    return { success: false, error: '組織が見つかりません' };
  }

  // 現在のユーザーID取得
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.log('[unfreezeOrganization] User not found');
    return { success: false, error: '認証エラー' };
  }
  console.log('[unfreezeOrganization] user:', user.id);

  // 組織を再開（RLS バイパスのため admin client を使用）
  console.log('[unfreezeOrganization] Updating organizations table...');
  console.log('[unfreezeOrganization] Target org ID:', org.orgId);
  const supabaseAdmin = getSupabaseAdmin();

  // 更新前の状態を確認
  const { data: beforeData } = await supabaseAdmin
    .from('organizations')
    .select('is_active, updated_at')
    .eq('id', org.orgId)
    .single();
  console.log('[unfreezeOrganization] BEFORE update:', JSON.stringify(beforeData));

  const { error: unfreezeError } = await supabaseAdmin
    .from('organizations')
    .update({ is_active: true })
    .eq('id', org.orgId);

  if (unfreezeError) {
    console.error('[unfreezeOrganization] Failed to unfreeze organization:', unfreezeError);
    return { success: false, error: '凍結解除に失敗しました' };
  }

  // 更新後の状態を確認
  const { data: afterData } = await supabaseAdmin
    .from('organizations')
    .select('is_active, updated_at')
    .eq('id', org.orgId)
    .single();
  console.log('[unfreezeOrganization] Organizations table updated successfully');
  console.log('[unfreezeOrganization] AFTER update (separate query):', JSON.stringify(afterData));

  // activity_logs に記録
  console.log('[unfreezeOrganization] Inserting activity log...');
  const { error: logError } = await supabase
    .from('activity_logs')
    .insert({
      org_id: org.orgId,
      user_id: user.id,
      action: 'org.unfrozen',
      payload: {
        unfrozen_by: 'owner',
      },
    });

  if (logError) {
    console.error('[unfreezeOrganization] Failed to log activity:', logError);
  } else {
    console.log('[unfreezeOrganization] Activity log inserted successfully');
  }

  console.log('[unfreezeOrganization] Revalidating path...');
  revalidatePath('/org-settings');
  console.log('[unfreezeOrganization] SUCCESS');
  return { success: true };
}

/**
 * 組織廃止
 *
 * - 組織名確認（誤操作防止）
 * - organizations.is_active = false
 * - activity_logs に記録
 *
 * @param confirmationName 確認用組織名
 */
export async function archiveOrganization(confirmationName: string) {
  const supabase = await createServerClient();
  const org = await getCurrentOrg();
  const roleContext = await getCurrentRole();

  // owner権限チェック
  if (!roleContext || roleContext.role !== 'owner') {
    return { success: false, error: 'Forbidden: owner権限が必要です' };
  }

  if (!org) {
    return { success: false, error: '組織が見つかりません' };
  }

  // 現在のユーザーID取得
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: '認証エラー' };
  }

  // 組織名確認
  if (org.orgName !== confirmationName) {
    return { success: false, error: '組織名が一致しません' };
  }

  // 組織を廃止（RLS バイパスのため admin client を使用）
  const supabaseAdmin = getSupabaseAdmin();
  const { error: archiveError } = await supabaseAdmin
    .from('organizations')
    .update({ is_active: false })
    .eq('id', org.orgId);

  if (archiveError) {
    console.error('[archiveOrganization] Failed to archive organization:', archiveError);
    return { success: false, error: '組織の廃止に失敗しました' };
  }

  // activity_logs に記録
  const { error: logError } = await supabase
    .from('activity_logs')
    .insert({
      org_id: org.orgId,
      user_id: user.id,
      action: 'org.archived',
      payload: {
        archived_by: 'owner',
        confirmation_name: confirmationName,
      },
    });

  if (logError) {
    console.error('[archiveOrganization] Failed to log activity:', logError);
  }

  revalidatePath('/org-settings');
  return { success: true };
}
