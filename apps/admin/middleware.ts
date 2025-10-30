/**
 * このmiddlewareは admin ドメイン専用。
 *
 * - 許可ロール: 'admin', 'owner' のみ。
 * - Edge Runtime 対応: DB接続なし、Cookie読み取りのみ
 * - 粗いゲート：本検証はサーバ側で行う
 */

import { NextRequest, NextResponse } from 'next/server'
import { DOMAINS } from '@repo/config-edge'

export function middleware(req: NextRequest) {
  const url = new URL(req.url)

  // ヒントCookie（サーバ側でセット）：org_id, role
  const orgId = req.cookies.get('org_id')?.value
  const role  = req.cookies.get('role')?.value // 'member' | 'admin' | 'owner'

  // 未ログイン相当は /login へ
  if (!orgId || !role) {
    return NextResponse.redirect(`${DOMAINS.www}/login?next=${encodeURIComponent(url.href)}`)
  }

  // memberはadminを使えない（粗いゲート）
  if (role === 'member') {
    return NextResponse.redirect(`${DOMAINS.app}/dashboard`)
  }

  // admin/ownerは通す（本検証はサーバで再度行う）
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)'
  ]
}
