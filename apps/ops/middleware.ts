/**
 * このmiddlewareは ops ドメイン専用。
 *
 * - 許可ロール: 'ops' のみ。
 * - Edge Runtime 対応: DB接続なし、Cookie読み取りのみ
 * - 粗いゲート：本検証はサーバ側で行う
 */

import { NextRequest, NextResponse } from 'next/server'
import { DOMAINS } from '@repo/config-edge'

export function middleware(req: NextRequest) {
  const url = new URL(req.url)
  const role = req.cookies.get('role')?.value

  // opsロール以外は拒否
  if (role !== 'ops') {
    return new Response(
      `403 Forbidden\n\nYou do not have permission to access the ops domain.\nRequired role: ops\nYour role: ${role || 'none'}`,
      {
        status: 403,
        headers: { 'Content-Type': 'text/plain' }
      }
    )
  }

  // opsは通す（本検証はサーバで再度行う）
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)'
  ]
}
