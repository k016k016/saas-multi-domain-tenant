/**
 * このmiddlewareは www ドメイン専用（LP/公開用）。
 *
 * - 基本的に誰でもアクセス可能（サインイン不要の公開サイト）
 * - 認証済みユーザーもwwwのページを閲覧可能
 * - Edge Runtime 対応: DB接続なし、Cookie読み取りのみ
 */

import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // /auth/callback は認証フロー用なので除外
  if (pathname.startsWith('/auth/')) {
    return NextResponse.next()
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)'
  ]
}
