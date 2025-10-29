/**
 * このmiddlewareは app ドメイン専用。
 *
 * - 許可ロール: 'member', 'admin', 'owner' 全員OK。
 * - app ドメインは日常業務UIなので、組織に所属している全員がアクセス可能。
 * - ops ロールはアクセス不可（事業者側は別ドメイン）。
 *
 * 禁止:
 * - www側middlewareにappの認可やrewriteを委ねる構成。
 * - 「テストのために一旦ゆるく通す」という緩和。
 *
 * 将来実装:
 * - ログイン状態の確認（Supabase Session）
 * - org_id の存在確認（組織未選択の場合は /switch-org へ）
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getCurrentRole } from '@repo/config';

export async function middleware(request: NextRequest) {
  // 1. 現在のユーザーロールを取得
  // NOTE: getCurrentRole()は現在ダミー実装。将来的にはSupabase Sessionを読む
  const { role } = await getCurrentRole();

  // 2. appドメインに入れるのは member / admin / owner
  //    ops ロールは拒否（ops専用ドメインがあるため）
  if (role === 'ops') {
    return new Response(
      `403 Forbidden\n\nOps users cannot access the app domain.\nPlease use the ops domain instead.\nYour role: ${role}`,
      {
        status: 403,
        headers: { 'Content-Type': 'text/plain' },
      }
    );
  }

  // 3. TODO: 将来的にはログイン状態とorg_idの確認を追加
  //
  // Supabase Sessionの確認:
  //   import { createServerClient } from '@repo/db';
  //   const supabase = createServerClient();
  //   const { data: { session } } = await supabase.auth.getSession();
  //   if (!session) {
  //     return NextResponse.redirect(new URL('/login', request.url));
  //   }
  //
  // org_id Cookieの確認:
  //   import { getOrgIdCookie } from '@repo/config';
  //   const orgId = await getOrgIdCookie();
  //   if (!orgId) {
  //     return NextResponse.redirect(new URL('/switch-org', request.url));
  //   }

  // 4. 権限OK: 次の処理へ
  return NextResponse.next();
}

// このmiddlewareはappドメインのすべてのパスに適用される
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
