/**
 * このmiddlewareは admin ドメイン専用。
 *
 * - 許可ロール: 'admin', 'owner' のみ。
 * - 'member' やそれ以外のロールは 403 にするべき。
 * - このチェックは admin 側で完結させる。他ドメイン(www/app/ops)に依存しない。
 *
 * 禁止:
 * - www側middlewareにadminの認可やrewriteを委ねる構成。
 * - 「テストのために一旦ゆるく通す」という緩和。
 *
 * 監査:
 * - admin画面から実行される高リスク操作（請求変更 / 組織凍結 / owner権限譲渡 / admin権限再割当 など）は
 *   activity_logs に必ず記録されるべき。ここを省略する実装提案はNG。
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getCurrentRole, hasRole } from '@repo/config';

export async function middleware(request: NextRequest) {
  // 1. 現在のユーザーロールを取得
  // NOTE: getCurrentRole()は現在ダミー実装。将来的にはSupabase Sessionを読む
  const { role } = await getCurrentRole();

  // 2. adminドメインに入れるのは admin と owner のみ
  if (!hasRole(role, 'admin')) {
    // 403 Forbidden を返す
    return new Response(
      `403 Forbidden\n\nYou do not have permission to access the admin domain.\nRequired role: admin or owner\nYour role: ${role}`,
      {
        status: 403,
        headers: { 'Content-Type': 'text/plain' },
      }
    );
  }

  // 3. 権限OK: 次の処理へ
  return NextResponse.next();
}

// このmiddlewareはadminドメインのすべてのパスに適用される
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
