/**
 * このmiddlewareは ops ドメイン専用。
 *
 * - 許可ロール: 'ops' のみ（サーバー側で検証）
 * - Edge Runtime 対応: DB接続なし、Supabase Session Cookie読み取りのみ
 * - 粗いゲート：認証チェックのみ、role検証はサーバ側で行う
 *
 * 重要: roleはCookieではなくDBで管理
 */

import { NextRequest, NextResponse } from 'next/server'
import { DOMAINS } from '@repo/config-edge'

export function middleware(req: NextRequest) {
  const url = new URL(req.url)

  // Supabase Session Cookie の存在確認（認証状態チェック）
  // NOTE: Supabase の Cookie 名は `sb-<project-ref>-auth-token` の形式
  const hasSupabaseSession = Array.from(req.cookies.getAll()).some(
    cookie => cookie.name.startsWith('sb-') && cookie.name.includes('auth-token')
  )

  // 未ログインの場合は /login へリダイレクト
  if (!hasSupabaseSession) {
    return NextResponse.redirect(`${DOMAINS.www}/login?next=${encodeURIComponent(url.href)}`)
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
