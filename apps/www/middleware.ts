/**
 * このmiddlewareは www ドメイン専用（LP/公開用）。
 *
 * - 機密データや組織内部データを返さない。
 * - 認証済みユーザーの管理画面(admin)をここで代理提供しない。
 * - wwwドメインは基本的に誰でもアクセス可能（ログイン不要の公開サイト）。
 *
 * 禁止:
 * - wwwをゲートウェイ化して、host名やパスで admin/app/ops にrewriteする。
 *   各ドメインは別アプリとして独立デプロイされる前提。
 * - 他ドメイン（app/admin/ops）のルーティングや認可を肩代わりする。
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@repo/db';

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // 1. /auth/callback は認証フロー用なので除外
  if (pathname.startsWith('/auth/')) {
    return NextResponse.next();
  }

  // 2. 認証済みユーザーは app ドメインへリダイレクト
  //    www は未認証ユーザー用（LP・ログイン導線）
  try {
    const supabase = createServerClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (session?.user) {
      // 認証済み → app ドメインへリダイレクト
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://app.local.test:3002';
      return NextResponse.redirect(appUrl);
    }
  } catch (error) {
    console.error('[www middleware] Session check failed:', error);
    // エラー時は通常のフローを継続
  }

  // 3. wwwドメインのリクエストをwwwディレクトリにリライト
  // 既にwwwディレクトリ配下にいる場合はリライトしない
  if (pathname.startsWith('/www')) {
    return NextResponse.next();
  }

  // wwwディレクトリへのリライト
  const rewriteUrl = new URL(`/www${pathname}`, request.url);

  return NextResponse.rewrite(rewriteUrl);
}

// Middlewareの適用パス設定
export const config = {
  matcher: [
    /*
     * 以下を除く全てのパスにマッチ:
     * - api (APIルート)
     * - _next/static (静的ファイル)
     * - _next/image (画像最適化ファイル)
     * - favicon.ico (ファビコン)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
