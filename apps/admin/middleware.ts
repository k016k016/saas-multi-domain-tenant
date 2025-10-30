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
import { createServerClient } from '@repo/db';
import { getCurrentRole, hasRole } from '@repo/config';
import { getOrgIdCookie } from '@repo/config';

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const wwwUrl = process.env.NEXT_PUBLIC_WWW_URL || 'http://www.local.test:3001';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://app.local.test:3002';

  // 1. Supabase Sessionの確認（認証必須）
  try {
    const supabase = createServerClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.user) {
      // 未認証 → www のログインページへリダイレクト
      return NextResponse.redirect(`${wwwUrl}/www/login`);
    }
  } catch (error) {
    console.error('[admin middleware] Session check failed:', error);
    return NextResponse.redirect(`${wwwUrl}/www/login`);
  }

  // 2. ロールチェック（admin / owner のみ許可）
  const roleContext = await getCurrentRole();

  if (!roleContext) {
    // ロールが取得できない（org未選択 or 未所属）
    return new Response(
      '403 Forbidden\n\nYou are not a member of any organization.\nPlease contact your administrator.',
      {
        status: 403,
        headers: { 'Content-Type': 'text/plain' },
      }
    );
  }

  const { role } = roleContext;

  // admin ドメインに入れるのは admin と owner のみ
  if (!hasRole(role, 'admin')) {
    // member ロールは 403 を返す（壁は壁として落ちる）
    return new Response(
      '403 Forbidden\n\nYou do not have permission to access the admin domain.\nRole required: admin or owner.',
      {
        status: 403,
        headers: { 'Content-Type': 'text/plain' },
      }
    );
  }

  // 3. org_id Cookieの確認
  const orgId = await getOrgIdCookie();
  if (!orgId) {
    // → app の /switch-org へリダイレクト（admin には switch-org ページが無い）
    return NextResponse.redirect(`${appUrl}/switch-org`);
  }

  // 4. 権限OK: 次の処理へ
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
