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
      const wwwUrl =
        process.env.NEXT_PUBLIC_WWW_URL ||
        process.env.WWW_URL ||
        'http://www.local.test:3001';
      return NextResponse.redirect(`${wwwUrl}/login?error=auth_failed`);
    }

    // Supabase Session は createServerClient() が自動的に Cookie を管理
    // app ドメインへリダイレクト（org/role は DB で解決）
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.APP_URL ||
      'http://app.local.test:3002';
    return NextResponse.redirect(appUrl);
  }

  // code がない場合はログインページへ戻す
  const wwwUrl =
    process.env.NEXT_PUBLIC_WWW_URL ||
    process.env.WWW_URL ||
    'http://www.local.test:3001';
  return NextResponse.redirect(`${wwwUrl}/login`);
}
