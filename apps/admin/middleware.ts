/**
 * このmiddlewareは admin ドメイン専用。
 *
 * - 許可ロール: 'admin', 'owner' のみ（サーバー側で検証）
 * - Edge Runtime 対応: DB接続なし、Supabase Session Cookie読み取りのみ
 * - 粗いゲート：認証チェックのみ、role検証はサーバ側で行う
 *
 * 重要: org_id/roleはCookieではなくDBで管理
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

  // 未サインインの場合は /login へリダイレクト
  if (!hasSupabaseSession) {
    // url.hrefではなくDOMAINS.adminを使用してリダイレクト先を構築
    // req.urlはlocalhostになる場合があるため、環境変数から取得したドメインを使用
    const nextUrl = `${DOMAINS.admin}${url.pathname}${url.search}`
    const redirectUrl = `${DOMAINS.www}/login?next=${encodeURIComponent(nextUrl)}`
    return NextResponse.redirect(redirectUrl)
  }

  // Phase 3: URLパラメータ ?org=slug をX-Org-Slugヘッダーとして渡す
  const orgSlugParam = url.searchParams.get('org')
  if (orgSlugParam) {
    const response = NextResponse.next()
    response.headers.set('X-Org-Slug', orgSlugParam)
    return response
  }

  // 認証済みユーザーは通す
  // IMPORTANT: role検証 (admin/owner のみ許可) は各ページで行う
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)'
  ]
}
