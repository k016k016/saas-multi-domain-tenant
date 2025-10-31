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
 *
 * 注意: domainを指定しない場合、Cookieは設定したホストでのみ有効になります。
 * サブドメイン間で共有する場合は、環境変数でdomainを指定してください。
 * 例: NEXT_PUBLIC_COOKIE_DOMAIN=.example.com
 */
const COOKIE_DOMAIN = process.env.NEXT_PUBLIC_COOKIE_DOMAIN || undefined;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

/**
 * org_id と role をCookieに保存
 *
 * サブドメイン間で共有されるため、app/admin/ops のすべてで同じorg_idとroleが参照される。
 *
 * 使用例:
 * ```typescript
 * import { setOrgIdCookie } from '@repo/config';
 *
 * // Server Action内で
 * await setOrgIdCookie('org_12345', 'admin');
 * ```
 *
 * @param orgId - 組織ID (UUID)
 * @param role - ユーザーのロール ('member' | 'admin' | 'owner' | 'ops')
 */
export async function setOrgIdCookie(orgId: string, role: string): Promise<void> {
  const cookieStore = await cookies();

  const cookieOptions: {
    domain?: string;
    path: string;
    maxAge: number;
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'lax';
  } = {
    path: '/',
    maxAge: 60 * 60 * 24 * 365, // 1年
    httpOnly: false, // JavaScriptから読み取り可能
    secure: IS_PRODUCTION, // 本番環境ではHTTPSのみ
    sameSite: 'lax', // CSRF対策
  };

  // domainが指定されている場合のみ設定
  if (COOKIE_DOMAIN) {
    cookieOptions.domain = COOKIE_DOMAIN;
  }

  // org_id Cookie
  cookieStore.set('org_id', orgId, cookieOptions);

  // role Cookie
  cookieStore.set('role', role, cookieOptions);
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
  const cookie = cookieStore.get('org_id');
  return cookie?.value || null;
}

/**
 * org_id と role Cookieを削除
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

  const deleteOptions: {
    name: string;
    domain?: string;
    path: string;
  } = {
    name: 'org_id',
    path: '/',
  };

  if (COOKIE_DOMAIN) {
    deleteOptions.domain = COOKIE_DOMAIN;
  }

  cookieStore.delete(deleteOptions);

  const roleDeleteOptions: {
    name: string;
    domain?: string;
    path: string;
  } = {
    name: 'role',
    path: '/',
  };

  if (COOKIE_DOMAIN) {
    roleDeleteOptions.domain = COOKIE_DOMAIN;
  }

  cookieStore.delete(roleDeleteOptions);
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
  const orgCookie = cookies.find(c => c.startsWith('org_id='));

  if (!orgCookie) {
    return null;
  }

  return orgCookie.split('=')[1] || null;
}
