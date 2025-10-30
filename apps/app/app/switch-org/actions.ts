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

import { createServerClient } from '@repo/db';
import { setOrgIdCookie } from '@repo/config';
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

  try {
    // 2. 現在のユーザーを取得
    const supabase = createServerClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.user) {
      return {
        success: false,
        error: '認証が必要です',
      };
    }

    const userId = session.user.id;

    // 3. ユーザーが指定組織に所属しているか確認
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('org_id, role')
      .eq('user_id', userId)
      .eq('org_id', targetOrgId)
      .single();

    if (profileError || !profile) {
      console.error('[switchOrganization] User not member of org:', { userId, targetOrgId, error: profileError });
      return {
        success: false,
        error: 'この組織にはアクセス権がありません',
      };
    }

    // 4. org_id Cookie を設定
    await setOrgIdCookie(targetOrgId);

    // 5. 監査ログ記録
    // TODO: activity_logsテーブルに記録
    // INSERT INTO activity_logs (user_id, org_id, action, details)
    // VALUES (userId, targetOrgId, 'org_switched', { ... })

    // 6. 成功を返す
    // 重要: redirect()は使用しない。nextUrlを返してクライアント側で遷移させる
    return {
      success: true,
      data: { targetOrgId },
      nextUrl: '/', // APPドメインのダッシュボードに戻る
    };
  } catch (err) {
    console.error('[switchOrganization] Unexpected error:', err);
    return {
      success: false,
      error: '予期しないエラーが発生しました',
    };
  }
}
