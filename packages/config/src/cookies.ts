/**
 * Cookie管理ヘルパー
 *
 * サブドメイン間で共有されるCookieの設定・取得を行う。
 * ドメイン: `.local.test` （開発環境）/ `.yourdomain.com` （本番環境）
 *
 * 重要:
 * - org_id はCookieに保存し、全サブドメインで共有
 * - HttpOnly: false（JavaScriptから読み取り可能）
 * - Secure: 本番環境ではtrue（HTTPSのみ）
 * - SameSite: Lax（CSRF対策）
 */

import { cookies } from 'next/headers';

/**
 * Cookie設定のデフォルト値
 */
const COOKIE_DOMAIN = process.env.NEXT_PUBLIC_COOKIE_DOMAIN || '.local.test';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

/**
 * org_id をCookieに保存
 *
 * サブドメイン間で共有されるため、app/admin/ops のすべてで同じorg_idが参照される。
 *
 * 使用例:
 * ```typescript
 * import { setOrgIdCookie } from '@repo/config';
 *
 * // Server Action内で
 * await setOrgIdCookie('org_12345');
 * ```
 *
 * @param orgId - 組織ID (UUID)
 */
export async function setOrgIdCookie(orgId: string): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.set('active_org_id', orgId, {
    domain: COOKIE_DOMAIN,
    path: '/',
    maxAge: 60 * 60 * 24 * 365, // 1年
    httpOnly: false, // JavaScriptから読み取り可能
    secure: IS_PRODUCTION, // 本番環境ではHTTPSのみ
    sameSite: 'lax', // CSRF対策
  });
}

/**
 * org_id をCookieから取得
 *
 * 組織が選択されていない場合は null を返す。
 *
 * 使用例:
 * ```typescript
 * import { getOrgIdCookie } from '@repo/config';
 *
 * // Server Component / Server Action内で
 * const orgId = await getOrgIdCookie();
 * if (!orgId) {
 *   // 組織未選択 → /switch-org へリダイレクト
 * }
 * ```
 *
 * @returns 組織ID または null
 */
export async function getOrgIdCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get('active_org_id');
  return cookie?.value || null;
}

/**
 * org_id Cookieを削除
 *
 * ログアウト時などに使用。
 *
 * 使用例:
 * ```typescript
 * import { clearOrgIdCookie } from '@repo/config';
 *
 * // Server Action内で
 * await clearOrgIdCookie();
 * ```
 */
export async function clearOrgIdCookie(): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.delete({
    name: 'active_org_id',
    domain: COOKIE_DOMAIN,
    path: '/',
  });
}

/**
 * クライアント側でorg_idを取得（ブラウザ用）
 *
 * 注意: HttpOnly=false のため、クライアント側からも読み取り可能。
 *
 * 使用例:
 * ```typescript
 * 'use client';
 * import { getOrgIdFromBrowser } from '@repo/config';
 *
 * const orgId = getOrgIdFromBrowser();
 * ```
 *
 * @returns 組織ID または null
 */
export function getOrgIdFromBrowser(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const cookies = document.cookie.split('; ');
  const orgCookie = cookies.find(c => c.startsWith('active_org_id='));

  if (!orgCookie) {
    return null;
  }

  return orgCookie.split('=')[1] || null;
}
