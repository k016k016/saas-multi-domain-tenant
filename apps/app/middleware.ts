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
import { createServerClient } from '@repo/db';
import { getCurrentRole } from '@repo/config';
import { getOrgIdCookie } from '@repo/config';

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const wwwUrl = process.env.NEXT_PUBLIC_WWW_URL || 'http://www.local.test:3001';

  // 1. Supabase Sessionの確認（認証必須）
  try {
    const supabase = createServerClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.user) {
      // 未認証 → www のログインページへリダイレクト
      return NextResponse.redirect(`${wwwUrl}/www/login`);
    }
  } catch (error) {
    console.error('[app middleware] Session check failed:', error);
    return NextResponse.redirect(`${wwwUrl}/www/login`);
  }

  // 2. ロールチェック（member / admin / owner のみ許可）
  const roleContext = await getCurrentRole();

  if (!roleContext) {
    // ロールが取得できない（org未選択 or 未所属）
    // TODO: org切り替えページへリダイレクト（次のステップで実装）
    return new Response(
      '403 Forbidden\n\nYou are not a member of any organization.\nPlease contact your administrator.',
      {
        status: 403,
        headers: { 'Content-Type': 'text/plain' },
      }
    );
  }

  const { role } = roleContext;

  // ops ロールは拒否（ops専用ドメインがあるため）
  if (role === 'ops') {
    const opsUrl = process.env.NEXT_PUBLIC_OPS_URL || 'http://ops.local.test:3004';
    return NextResponse.redirect(opsUrl);
  }

  // 3. org_id Cookieの確認
  const orgId = await getOrgIdCookie();
  if (!orgId) {
    // TODO: org切り替えページへリダイレクト（次のステップで実装）
    return new Response(
      '403 Forbidden\n\nNo organization selected.\nPlease select an organization.',
      {
        status: 403,
        headers: { 'Content-Type': 'text/plain' },
      }
    );
  }

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
