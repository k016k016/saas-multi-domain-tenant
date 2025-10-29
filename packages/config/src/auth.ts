/**
 * 認証・組織コンテキスト取得のダミー実装
 *
 * 将来的にはSupabaseセッションからorg_id/roleを解決する予定。
 * middlewareがorg_idを前提に動作し、アクティブな組織コンテキストを管理する。
 *
 * 重要な設計方針:
 * - Server Actionでは `{ success, nextUrl }` を返し、`redirect()`は使用しない。
 * - 画面遷移はクライアント側で `router.push(nextUrl)` 等を使って行う。
 * - org_idベースのアクセス制御とRLSは必須であり、バイパスは許可しない。
 */

export type Role = 'member' | 'admin' | 'owner' | 'ops';

export interface OrgContext {
  orgId: string;
  orgName: string;
}

export interface RoleContext {
  role: Role;
}

/**
 * 現在アクティブな組織コンテキストを取得
 *
 * 【現在の実装】
 * ハードコードされたダミー値を返す。
 *
 * 【将来の実装】
 * - Supabaseセッション + Cookieからアクティブなorg_idを取得
 * - middlewareでorg_idの妥当性検証済みであることを前提とする
 * - ユーザーが所属していないorg_idの場合は401/403を返す
 */
export async function getCurrentOrg(): Promise<OrgContext> {
  // TODO: 実際にはSupabaseセッション + Cookieから取得
  return {
    orgId: 'org_dummy_12345',
    orgName: 'サンプル組織A',
  };
}

/**
 * 現在のユーザーのロールを取得
 *
 * 【現在の実装】
 * ハードコードされたダミー値を返す。
 *
 * 【将来の実装】
 * 1. Supabase Sessionから user_id を取得:
 *    ```typescript
 *    import { createServerClient } from '@repo/db';
 *    const supabase = createServerClient();
 *    const { data: { session } } = await supabase.auth.getSession();
 *    const userId = session?.user?.id;
 *    ```
 *
 * 2. Cookieから org_id を取得:
 *    ```typescript
 *    import { getOrgIdCookie } from './cookies';
 *    const orgId = await getOrgIdCookie();
 *    ```
 *
 * 3. profiles テーブルから role を SELECT:
 *    ```typescript
 *    const { data } = await supabase
 *      .from('profiles')
 *      .select('role')
 *      .eq('user_id', userId)
 *      .eq('org_id', orgId)
 *      .single();
 *    return { role: data.role };
 *    ```
 *
 * - ロール階層: member ⊂ admin ⊂ owner (opsは別枠)
 * - この階層は固定であり、変更・追加・統合は禁止
 */
export async function getCurrentRole(): Promise<RoleContext> {
  // TODO: 実際にはSupabase profilesテーブルから取得
  // 開発時はここを 'member' / 'admin' / 'owner' / 'ops' に切り替えてテスト可能
  return {
    role: 'admin',
  };
}

/**
 * ロール権限チェック用ヘルパー
 *
 * ロール階層に基づいた権限チェックを行う。
 * - owner: すべての権限を持つ
 * - admin: member権限を含む
 * - member: 基本権限のみ
 * - ops: 事業者側の特殊ロール
 */
export function hasRole(userRole: Role, requiredRole: Role): boolean {
  if (requiredRole === 'ops') {
    return userRole === 'ops';
  }

  const roleHierarchy: Record<Role, number> = {
    member: 1,
    admin: 2,
    owner: 3,
    ops: 0, // ops は階層外
  };

  return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
}
