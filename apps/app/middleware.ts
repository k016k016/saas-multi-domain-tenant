/**
 * このmiddlewareは app ドメイン専用。
 *
 * - 許可ロール: 'member', 'admin', 'owner' 全員OK。
 * - Edge Runtime 対応: DB接続なし、Supabase Session Cookie読み取りのみ
 * - 粗いゲート：本検証はサーバ側で行う
 *
 * 重要: org_id/roleはCookieではなくDBで管理
 */

import { NextRequest, NextResponse } from 'next/server'
import { DOMAINS } from '@repo/config-edge'

export function middleware(req: NextRequest) {
  const url = new URL(req.url)

  // /switch-org は認証不要でアクセス可能
  if (url.pathname.startsWith('/switch-org')) {
    return NextResponse.next()
  }

  // Supabase Session Cookie の存在確認（認証状態チェック）
  // NOTE: Supabase の Cookie 名は `sb-<project-ref>-auth-token` の形式
  // 正確な名前を確認するため、すべてのCookieをチェック
  const hasSupabaseSession = Array.from(req.cookies.getAll()).some(
    cookie => cookie.name.startsWith('sb-') && cookie.name.includes('auth-token')
  )

  // 未ログインの場合は /login へリダイレクト
  if (!hasSupabaseSession) {
    return NextResponse.redirect(`${DOMAINS.www}/login?next=${encodeURIComponent(url.href)}`)
  }

  // 認証済みユーザーは通す（org/role検証はサーバ側で行う）
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)'
  ]
}
