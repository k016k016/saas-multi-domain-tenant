/**
 * Supabase 認証コールバック (Route Handler)
 *
 * 責務:
 * - Magic Link からのリダイレクトを処理
 * - code を session に交換
 * - Cookie に org_id と role を設定
 * - app ドメインへリダイレクト（組織未所属の場合は /switch-org）
 *
 * 注意:
 * - このエンドポイントは Supabase の emailRedirectTo で指定される
 * - セッション確立後は app ドメインへ遷移
 */

import { createServerClient } from '@repo/db';
import { setOrgIdCookie } from '@repo/config';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');

  if (code) {
    const supabase = await createServerClient();

    // code を session に交換
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error || !data.session) {
      console.error('[auth/callback] Session exchange failed:', error);
      // エラーの場合はログインページへ戻す
      const wwwUrl = process.env.NEXT_PUBLIC_WWW_URL || 'http://www.local.test:3001';
      return NextResponse.redirect(`${wwwUrl}/www/login?error=auth_failed`);
    }

    const userId = data.session.user.id;

    // ユーザーが所属する組織を取得
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('org_id, role')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (profileError) {
      console.error('[auth/callback] Profile fetch failed:', JSON.stringify(profileError, null, 2));
    }

    // 最初の組織を active_org_id として設定
    if (profiles && profiles.length > 0) {
      const firstOrg = profiles[0];
      await setOrgIdCookie(firstOrg.org_id);

      // app ドメインへリダイレクト
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://app.local.test:3002';
      return NextResponse.redirect(appUrl);
    } else {
      // 組織に所属していない場合は組織切替ページへ
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://app.local.test:3002';
      return NextResponse.redirect(`${appUrl}/switch-org`);
    }
  }

  // code がない場合はログインページへ戻す
  const wwwUrl = process.env.NEXT_PUBLIC_WWW_URL || 'http://www.local.test:3001';
  return NextResponse.redirect(`${wwwUrl}/www/login`);
}
