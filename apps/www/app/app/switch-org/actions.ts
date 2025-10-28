'use server';

/**
 * 組織切替のServer Action
 *
 * 重要な設計方針:
 * - redirect()は使用しない。必ず{ success, nextUrl }を返す
 * - クライアント側でrouter.push(nextUrl)を使って遷移する
 * - ユーザーが所属していないorg_idは拒否する
 * - 組織切替の操作はactivity_logsに記録する（将来実装）
 */

import { getCurrentOrg } from '@repo/config';
import type { ActionResult } from '@repo/config';

interface SwitchOrgData {
  targetOrgId: string;
}

/**
 * 組織を切り替える
 *
 * @param targetOrgId - 切り替え先の組織ID
 * @returns ActionResult - 成功/失敗とnextUrl
 */
export async function switchOrganization(
  targetOrgId: string
): Promise<ActionResult<SwitchOrgData>> {
  // 1. 入力バリデーション
  if (!targetOrgId || typeof targetOrgId !== 'string') {
    return {
      success: false,
      error: '組織IDが不正です',
    };
  }

  // 2. 現在のユーザーとorg_idを取得
  // TODO: 実際にはSupabaseセッションから現在のユーザーIDを取得
  const currentOrg = await getCurrentOrg();

  // 3. 所属チェック
  // TODO: 実際にはSupabase profilesテーブルでユーザーがtargetOrgIdに所属しているか確認
  // 現時点ではダミー実装
  const userOrganizations = [
    'org_dummy_12345',
    'org_dummy_67890',
    'org_dummy_abcde',
  ];

  if (!userOrganizations.includes(targetOrgId)) {
    return {
      success: false,
      error: 'この組織にはアクセス権がありません',
    };
  }

  // 4. セッション/Cookie更新
  // TODO: 実際にはSupabaseセッションとCookieを更新
  // - cookies().set('active_org_id', targetOrgId, { ... })
  // - middlewareがこのCookieを読んで動作する
  // 現時点ではダミー実装（何もしない）
  console.log(`[switchOrganization] Switching to org: ${targetOrgId}`);

  // 5. 監査ログ記録
  // TODO: activity_logsテーブルに記録
  // INSERT INTO activity_logs (user_id, org_id, action, details)
  // VALUES (current_user_id, targetOrgId, 'org_switched', { from: currentOrg.orgId, to: targetOrgId })

  // 6. 成功を返す
  // 重要: redirect()は使用しない。nextUrlを返してクライアント側で遷移させる
  return {
    success: true,
    data: { targetOrgId },
    nextUrl: '/', // APPドメインのダッシュボードに戻る
  };
}
