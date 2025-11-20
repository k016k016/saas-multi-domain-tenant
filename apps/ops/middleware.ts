/**
 * このmiddlewareは ops ドメイン専用。
 *
 * - 許可ロール: 'ops' のみ（サーバー側で検証）
 * - Edge Runtime 対応: DB接続なし、Supabase Session Cookie読み取りのみ
 * - 粗いゲート：認証チェックのみ、role検証はサーバ側で行う
 *
 * 重要:
 * - roleはCookieではなくDBで管理
 * - 未認証者は404を返す（opsドメインは非公開、導線不要）
 */

import { NextRequest, NextResponse } from 'next/server'

export function middleware(req: NextRequest) {
  const url = new URL(req.url)

  // /login パスは認証チェックをスキップ（ログインページ自体なので）
  if (url.pathname === '/login') {
    return NextResponse.next()
  }

  // Supabase Session Cookie の存在確認（認証状態チェック）
  // NOTE: Supabase の Cookie 名は `sb-<project-ref>-auth-token` の形式
  const hasSupabaseSession = Array.from(req.cookies.getAll()).some(
    cookie => cookie.name.startsWith('sb-') && cookie.name.includes('auth-token')
  )

  // 未認証の場合は404を返す（完全な404、ヘッダなし）
  // opsドメインは非公開、一般ユーザーへの導線は不要
  // ops関係者は直接 ops/login にアクセスする
  if (!hasSupabaseSession) {
    return new NextResponse(null, { status: 404 })
  }

  // 認証済みユーザーは通す
  // IMPORTANT: role検証 (ops のみ許可) は各ページで行う
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)'
  ]
}
