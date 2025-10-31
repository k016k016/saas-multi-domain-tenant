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

  // Supabase Session Cookieの存在確認
  // NOTE: Supabase の Cookie 名は `sb-<project-ref>-auth-token` の形式
  const hasSupabaseSession = Array.from(request.cookies.getAll()).some(
    cookie => cookie.name.startsWith('sb-') && cookie.name.includes('auth-token')
  )

  // 認証済みかつログインページ以外にいる場合は app ドメインへリダイレクト
  if (hasSupabaseSession && !pathname.startsWith('/www/login')) {
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
