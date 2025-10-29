/**
 * このmiddlewareは ops ドメイン専用。
 *
 * - 許可ロール: 'ops' のみ。
 * - ops ドメインは事業者側の内部コンソールなので、ops ロール以外はアクセス不可。
 * - member / admin / owner はアクセス禁止（別ドメインを使うべき）。
 *
 * 禁止:
 * - www側middlewareにopsの認可やrewriteを委ねる構成。
 * - 「テストのために一旦ゆるく通す」という緩和。
 * - opsを「RLSバイパス神ビュー」にする実装（現段階はダミーページのみ）。
 *
 * 将来実装:
 * - IP制限（事業者側のオフィスIPのみ許可）
 * - 横断閲覧機能（現時点では未実装）
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getCurrentRole } from '@repo/config';

export async function middleware(request: NextRequest) {
  // 1. 現在のユーザーロールを取得
  // NOTE: getCurrentRole()は現在ダミー実装。将来的にはSupabase Sessionを読む
  const { role } = await getCurrentRole();

  // 2. opsドメインに入れるのは ops ロールのみ
  if (role !== 'ops') {
    return new Response(
      `403 Forbidden\n\nYou do not have permission to access the ops domain.\nRequired role: ops\nYour role: ${role}`,
      {
        status: 403,
        headers: { 'Content-Type': 'text/plain' },
      }
    );
  }

  // 3. TODO: 将来的にはIP制限を追加
  // const clientIp = request.headers.get('x-forwarded-for') || request.ip;
  // if (!isAllowedIp(clientIp)) {
  //   return new Response('403 Forbidden - IP not allowed', { status: 403 });
  // }

  // 4. 権限OK: 次の処理へ
  return NextResponse.next();
}

// このmiddlewareはopsドメインのすべてのパスに適用される
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
