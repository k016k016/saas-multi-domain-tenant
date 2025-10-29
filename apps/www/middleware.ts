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

export async function middleware(request: NextRequest) {
  // 1. wwwドメインは基本的に全員アクセス可能
  //    LP・ログイン導線・公開情報のみを提供
  //    特別なアクセス制御は不要

  // 2. 将来的にはログイン済みユーザーを適切なドメインにリダイレクトする処理を追加
  // TODO: 認証状態とロールに応じてリダイレクト
  // if (isAuthenticated()) {
  //   const { role } = await getCurrentRole();
  //   if (role === 'ops') {
  //     return NextResponse.redirect(new URL('http://ops.example.com', request.url));
  //   }
  //   // 他のロールはappドメインへ
  //   return NextResponse.redirect(new URL('http://app.example.com', request.url));
  // }

  // 3. wwwドメインのリクエストをwwwディレクトリにリライト
  const pathname = request.nextUrl.pathname;

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
