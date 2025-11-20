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

import { createServerClient, logActivity } from '@repo/db';
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
  const reqId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  console.log('[SWITCH_ORG][START]', { reqId, targetOrgId });
  console.log('[SWITCH_ORG][RECV]', { targetOrgId });

  // 1. 入力バリデーション
  if (!targetOrgId || typeof targetOrgId !== 'string') {
    console.log('[SWITCH_ORG][INVALID_INPUT]', { reqId, targetOrgId });
    return {
      success: false,
      error: '組織IDが不正です',
    };
  }

  try {
    // 2. 現在のユーザーを取得
    const supabase = await createServerClient();
    const { data: { session } } = await supabase.auth.getSession();
    console.log('[SWITCH_ORG][AUTH]', { reqId, uid: session?.user?.id });

    if (!session?.user) {
      console.log('[SWITCH_ORG][NO_AUTH]', { reqId });
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

    console.log('[SWITCH_ORG][MEMBERSHIP]', {
      reqId,
      hasProfile: !!profile,
      profileError: profileError?.message || null,
      profileCode: profileError?.code || null,
    });

    if (profileError || !profile) {
      console.error('[switchOrganization] User not member of org:', { userId, targetOrgId, error: profileError });
      console.log('[SWITCH_ORG][DENY]', { reqId });
      return {
        success: false,
        error: 'この組織にはアクセス権がありません',
      };
    }

    // 4. active org を DB に保存（Cookie は使わない）
    const { error: updateError } = await supabase
      .from('user_org_context')
      .upsert({
        user_id: userId,
        org_id: targetOrgId,
        updated_at: new Date().toISOString(),
      });

    if (updateError) {
      console.error('[switchOrganization] Failed to update user_org_context:', updateError);
      return {
        success: false,
        error: '組織の切り替えに失敗しました',
      };
    }

    // 5. 監査ログ記録
    const logResult = await logActivity(supabase, {
      orgId: targetOrgId,
      userId,
      action: 'org_switched',
      payload: {
        to_org_id: targetOrgId,
        role: profile.role,
        timestamp: new Date().toISOString(),
      },
    });

    if (logResult.error) {
      console.warn('[switchOrganization] Activity log failed:', logResult.error);
      // 監査ログ失敗は致命的エラーではないが、ワーニングを出す
    }

    // 6. Phase 3: 組織のslugを取得してサブドメインURLを生成
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('slug')
      .eq('id', targetOrgId)
      .single();

    if (orgError || !org?.slug) {
      console.error('[switchOrganization] Failed to get organization slug:', orgError);
      // slugが取得できない場合は従来の方法にフォールバック
      return {
        success: true,
        data: { targetOrgId },
        nextUrl: '/', // APPドメインのダッシュボードに戻る
      };
    }

    // サブドメインURLを生成
    const fallbackProtocol = process.env.NODE_ENV === 'production' ? 'https:' : 'http:';
    const appUrlFromEnv = process.env.NEXT_PUBLIC_APP_URL;
    let parsedAppUrl: URL | null = null;

    if (appUrlFromEnv) {
      try {
        parsedAppUrl = new URL(appUrlFromEnv);
      } catch {
        try {
          parsedAppUrl = new URL(`${fallbackProtocol}//${appUrlFromEnv}`);
        } catch {
          parsedAppUrl = null;
        }
      }
    }

    const protocol = parsedAppUrl?.protocol ?? fallbackProtocol;
    const baseHost =
      process.env.NEXT_PUBLIC_APP_DOMAIN?.replace(/^https?:\/\//, '') ??
      parsedAppUrl?.host ??
      'app.local.test:3002';

    const nextUrl = `${protocol}//${org.slug}.${baseHost}/dashboard`;

    // 7. 成功を返す
    // 重要: redirect()は使用しない。nextUrlを返してクライアント側で遷移させる
    return {
      success: true,
      data: { targetOrgId },
      nextUrl, // サブドメインURLへ遷移
    };
  } catch (err) {
    console.error('[switchOrganization] Unexpected error:', err);
    return {
      success: false,
      error: '予期しないエラーが発生しました',
    };
  }
}
