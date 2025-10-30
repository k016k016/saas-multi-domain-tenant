/**
 * このmiddlewareは www ドメイン専用（LP/公開用）。
 *
 * - 基本的に誰でもアクセス可能（ログイン不要の公開サイト）
 * - 認証済みユーザーは app ドメインへリダイレクト
 * - Edge Runtime 対応: DB接続なし、Cookie読み取りのみ
 */

import { NextRequest, NextResponse } from 'next/server'
import { DOMAINS } from '@repo/config-edge'

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // /auth/callback は認証フロー用なので除外
  if (pathname.startsWith('/auth/')) {
    return NextResponse.next()
  }

  // 認証済みユーザー（org_idとroleがあれば）は app ドメインへリダイレクト
  const orgId = request.cookies.get('org_id')?.value
  const role  = request.cookies.get('role')?.value

  if (orgId && role) {
    // 認証済み → app ドメインへリダイレクト
    return NextResponse.redirect(DOMAINS.app)
  }

  // wwwドメインのリクエストをwwwディレクトリにリライト
  if (pathname.startsWith('/www')) {
    return NextResponse.next()
  }

  const rewriteUrl = new URL(`/www${pathname}`, request.url)
  return NextResponse.rewrite(rewriteUrl)
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)'
  ]
}
