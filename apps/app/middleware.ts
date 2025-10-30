/**
 * このmiddlewareは app ドメイン専用。
 *
 * - 許可ロール: 'member', 'admin', 'owner' 全員OK。
 * - Edge Runtime 対応: DB接続なし、Cookie読み取りのみ
 * - 粗いゲート：本検証はサーバ側で行う
 */

import { NextRequest, NextResponse } from 'next/server'
import { DOMAINS } from '@repo/config-edge'

export function middleware(req: NextRequest) {
  const url = new URL(req.url)
  const orgId = req.cookies.get('org_id')?.value
  const role  = req.cookies.get('role')?.value

  // /switch-org は認証不要でアクセス可能
  if (url.pathname.startsWith('/switch-org')) {
    return NextResponse.next()
  }

  // 未ログイン相当は /login へ
  if (!orgId || !role) {
    return NextResponse.redirect(`${DOMAINS.www}/login?next=${encodeURIComponent(url.href)}`)
  }

  // member/admin/ownerは通す（本検証はサーバで再度行う）
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)'
  ]
}
