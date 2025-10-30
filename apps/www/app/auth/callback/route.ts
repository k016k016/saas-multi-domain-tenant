/**
 * Supabase 認証コールバック (Route Handler)
 *
 * 責務:
 * - Magic Link からのリダイレクトを処理
 * - code を session に交換
 * - app ドメインへリダイレクト
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
    await supabase.auth.exchangeCodeForSession(code);
  }

  // 認証成功後は app ドメインへリダイレクト
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://app.local.test:3002';
  return NextResponse.redirect(appUrl);
}
