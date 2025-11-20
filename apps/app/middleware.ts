/**
 * このmiddlewareは app ドメイン専用。
 *
 * - 許可ロール: 'member', 'admin', 'owner' 全員OK。
 * - Edge Runtime 対応: DB接続なし、Supabase Session Cookie読み取りのみ
 * - 粗いゲート：本検証はサーバ側で行う
 * - Phase 2: Hostヘッダーからorg slugを抽出してX-Org-Slugヘッダーとして渡す
 *
 * 重要: org_id/roleはCookieではなくDBで管理
 */

import { NextRequest, NextResponse } from 'next/server'
import { DOMAINS } from '@repo/config-edge'

export function middleware(req: NextRequest) {
  const url = new URL(req.url)

  // Supabase Session Cookie の存在確認（認証状態チェック）
  // NOTE: Supabase の Cookie 名は `sb-<project-ref>-auth-token` の形式
  // 正確な名前を確認するため、すべてのCookieをチェック
  const hasSupabaseSession = Array.from(req.cookies.getAll()).some(
    cookie => cookie.name.startsWith('sb-') && cookie.name.includes('auth-token')
  )

  // 未サインインの場合は /login へリダイレクト
  if (!hasSupabaseSession) {
    // url.hrefではなくDOMAINS.appを使用してリダイレクト先を構築
    // req.urlはlocalhostになる場合があるため、環境変数から取得したドメインを使用
    const nextUrl = `${DOMAINS.app}${url.pathname}${url.search}`
    return NextResponse.redirect(`${DOMAINS.www}/login?next=${encodeURIComponent(nextUrl)}`)
  }

  // Phase 2: Hostヘッダーからorg slugを抽出
  const host = req.headers.get('host') || ''
  let orgSlug: string | null = null

  // app.local.test または app.example.com のパターンから抽出
  // 例: acme.app.local.test -> acme, beta.app.example.com -> beta
  if (host.includes('.app.')) {
    const parts = host.split('.')
    // 最初の部分がサブドメイン（orgSlug）
    if (parts.length >= 3 && parts[0] !== 'www' && parts[0] !== 'app') {
      orgSlug = parts[0]
    }
  }

  // orgSlugが存在する場合はX-Org-Slugヘッダーとして渡す
  if (orgSlug) {
    const response = NextResponse.next()
    response.headers.set('X-Org-Slug', orgSlug)
    return response
  }

  // 認証済みユーザーは通す（org/role検証はサーバ側で行う）
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)'
  ]
}
