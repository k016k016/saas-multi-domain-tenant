'use server';

/**
 * 組織作成のServer Actions
 *
 * 責務:
 * - ops（システム管理者）が新しい組織とownerユーザーを作成する
 * - 組織にはslugが必須（サブドメインルーティング用）
 * - ownerユーザーを作成し、profilesとuser_org_contextに登録
 * - すべての操作はactivity_logsに記録する
 *
 * 設計方針:
 * - redirect()は使用しない。必ず{ success, nextUrl }を返す
 * - クライアント側でrouter.push(nextUrl)を使って遷移する
 * - ops管理者のみがアクセス可能（middlewareで制御）
 */

import { getSupabaseAdmin, logActivity } from '@repo/db';
import { createServerClient } from '@repo/db';
import type { ActionResult } from '@repo/config';

/**
 * 新しい組織とownerユーザーを作成する
 *
 * @param orgName - 組織名
 * @param orgSlug - 組織のスラッグ（サブドメイン用、英数字とハイフンのみ）
 * @param ownerEmail - ownerのメールアドレス
 * @param ownerPassword - ownerの初期パスワード
 * @param ownerName - ownerの氏名
 * @returns ActionResult
 */
export async function createOrganization(
  orgName: string,
  orgSlug: string,
  ownerEmail: string,
  ownerPassword: string,
  ownerName: string
): Promise<ActionResult> {
  // 1. 入力バリデーション
  if (!orgName || orgName.trim().length === 0) {
    return {
      success: false,
      error: '組織名を入力してください',
    };
  }

  if (!orgSlug || orgSlug.trim().length === 0) {
    return {
      success: false,
      error: 'スラッグを入力してください',
    };
  }

  // slugの形式チェック（英数字とハイフンのみ、小文字）
  const slugRegex = /^[a-z0-9-]+$/;
  if (!slugRegex.test(orgSlug)) {
    return {
      success: false,
      error: 'スラッグは英小文字、数字、ハイフンのみ使用できます',
    };
  }

  // 予約語チェック
  const reservedSlugs = ['www', 'app', 'admin', 'ops', 'api', 'static', 'assets'];
  if (reservedSlugs.includes(orgSlug)) {
    return {
      success: false,
      error: 'このスラッグは予約されているため使用できません',
    };
  }

  if (!ownerEmail || typeof ownerEmail !== 'string') {
    return {
      success: false,
      error: 'メールアドレスが不正です',
    };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(ownerEmail)) {
    return {
      success: false,
      error: 'メールアドレスの形式が正しくありません',
    };
  }

  if (!ownerPassword || ownerPassword.length < 6) {
    return {
      success: false,
      error: 'パスワードは6文字以上で指定してください',
    };
  }

  if (!ownerName || ownerName.trim().length === 0) {
    return {
      success: false,
      error: 'ownerの氏名を入力してください',
    };
  }

  // 2. 現在のユーザーIDを取得（監査ログ用）
  const supabase = await createServerClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  const currentUserId = user?.id;
  if (!currentUserId) {
    return {
      success: false,
      error: '認証セッションが見つかりません',
    };
  }

  // 3. Service Role Keyで操作
  const supabaseAdmin = getSupabaseAdmin();

  // 3-1. 組織を作成
  const { data: orgData, error: orgError } = await supabaseAdmin
    .from('organizations')
    .insert({
      name: orgName.trim(),
      slug: orgSlug.trim().toLowerCase(),
      plan: 'free',
      is_active: true,
    })
    .select()
    .single();

  if (orgError) {
    console.error('[createOrganization] Organization creation error:', orgError);
    if (orgError.message.includes('duplicate key') || orgError.code === '23505') {
      return { success: false, error: 'このスラッグは既に使用されています' };
    }
    return { success: false, error: '組織の作成に失敗しました' };
  }

  const orgId = orgData.id;

  // 3-2. ownerユーザーをSupabase Authで作成
  const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email: ownerEmail,
    password: ownerPassword,
    email_confirm: true,
    user_metadata: {
      name: ownerName.trim(),
    },
  });

  if (createError) {
    console.error('[createOrganization] Create owner user error:', createError);
    // 組織作成に成功したがユーザー作成に失敗した場合、組織を削除
    await supabaseAdmin.from('organizations').delete().eq('id', orgId);

    if (createError.message.includes('already been registered')) {
      return { success: false, error: 'このメールアドレスは既に登録されています' };
    }
    return { success: false, error: 'ownerユーザーの作成に失敗しました' };
  }

  const ownerId = createData.user.id;

  // 3-3. profilesテーブルにownerレコードを作成
  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .insert({
      user_id: ownerId,
      org_id: orgId,
      role: 'owner',
    });

  if (profileError) {
    console.error('[createOrganization] Profile creation error:', profileError);
    // ユーザーと組織を削除してロールバック
    await supabaseAdmin.auth.admin.deleteUser(ownerId);
    await supabaseAdmin.from('organizations').delete().eq('id', orgId);
    return { success: false, error: 'ownerレコードの作成に失敗しました' };
  }

  // 3-4. user_org_contextを設定
  const { error: contextError } = await supabaseAdmin
    .from('user_org_context')
    .upsert({
      user_id: ownerId,
      org_id: orgId,
      updated_at: new Date().toISOString(),
    });

  if (contextError) {
    console.error('[createOrganization] Context creation error:', contextError);
    // 致命的ではないのでワーニングのみ
  }

  // 4. 監査ログ記録（ops管理者の操作として記録）
  const logResult = await logActivity(supabaseAdmin, {
    orgId: orgId,
    userId: currentUserId,
    action: 'organization_created',
    payload: {
      org_name: orgName.trim(),
      org_slug: orgSlug.trim().toLowerCase(),
      owner_email: ownerEmail,
      owner_name: ownerName.trim(),
      timestamp: new Date().toISOString(),
    },
  });

  if (logResult.error) {
    console.warn('[createOrganization] Activity log failed:', logResult.error);
  }

  // 5. 成功を返す
  return {
    success: true,
    nextUrl: '/orgs',
  };
}
