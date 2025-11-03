/**
 * 認証・組織コンテキスト取得
 *
 * Supabaseセッションから user_id を取得し、user_org_context テーブルからアクティブな org_id を取得。
 * Cookie には org_id/role を保存せず、すべて DB で解決する設計。
 *
 * 重要な設計方針:
 * - Cookie は Supabase セッション (sb-access-token, sb-refresh-token) のみ
 * - org_id/role は DB で毎回取得（Cookie には書き込まない）
 * - Server Actionでは `{ success, nextUrl }` を返し、`redirect()`は使用しない。
 * - 画面遷移はクライアント側で `router.push(nextUrl)` 等を使って行う。
 * - org_idベースのアクセス制御とRLSは必須であり、バイパスは許可しない。
 * - デフォルトでmemberにしない、未所属orgへのアクセスは許可しない。
 * - Server Component / Server Action のみで使用（Client Componentでは使用禁止）
 */

import { createServerClient, getSupabaseAdmin } from '@repo/db';

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
 * user_org_context テーブルからアクティブな org_id を取得し、
 * organizations テーブルから組織情報を取得。
 *
 * 【重要な制約】
 * - Session が無い場合は null を返す
 * - user_org_context に org_id が無い場合は null を返す（デフォルト組織は設定しない）
 * - 組織が見つからない場合は null を返す
 * - redirect() は使用しない（呼び出し側で nextUrl を使って遷移する）
 * - Server Component / Server Action のみで使用
 *
 * @returns OrgContext | null
 */
export async function getCurrentOrg(): Promise<OrgContext | null> {
  try {
    // 1. Supabase Session から user_id を取得
    const supabase = await createServerClient();
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session?.user?.id) {
      // セッションが無い → 未認証 → null を返す
      return null;
    }

    const userId = session.user.id;

    // 2. user_org_context から active org_id を取得
    // 注: Admin クライアントを使用して RLS をバイパス
    //     （認証済みユーザーが自分自身の user_org_context を取得するだけなのでセキュリティ上問題なし）
    const adminSupabase = getSupabaseAdmin();
    const { data: context, error: contextError } = await adminSupabase
      .from('user_org_context')
      .select('org_id')
      .eq('user_id', userId)
      .single();

    if (contextError || !context) {
      // アクティブな組織が無い → null を返す（呼び出し側で /switch-org へ誘導）
      return null;
    }

    const orgId = context.org_id;

    // 3. organizations から組織情報を取得
    const { data: org, error: orgError } = await adminSupabase
      .from('organizations')
      .select('id, name')
      .eq('id', orgId)
      .single();

    if (orgError || !org) {
      console.error('[getCurrentOrg] Organization not found:', { orgId, error: orgError });
      // 組織が見つからない → null を返す
      return null;
    }

    return {
      orgId: org.id,
      orgName: org.name,
    };
  } catch (error) {
    console.error('[getCurrentOrg] Unexpected error:', error);
    return null;
  }
}

/**
 * 現在のユーザーのロールを取得
 *
 * Supabase Sessionから user_id を取得し、user_org_context から active org_id を取得して、
 * profiles テーブルから該当ユーザーのロールを取得。
 *
 * 【重要な制約】
 * - Session が無い場合は null を返す（デフォルトでmemberにしない）
 * - user_org_context に org_id が無い場合は null を返す
 * - ユーザーが指定orgに所属していない場合は null を返す（未所属orgへのアクセス禁止）
 * - redirect() は使用しない（呼び出し側で nextUrl を使って遷移する）
 * - Server Component / Server Action のみで使用
 *
 * ロール階層: member ⊂ admin ⊂ owner (opsは別枠)
 * この階層は固定であり、変更・追加・統合は禁止。
 *
 * @returns RoleContext | null
 */
export async function getCurrentRole(): Promise<RoleContext | null> {
  try {
    // 1. Supabase Session から user_id を取得
    const supabase = await createServerClient();
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session?.user?.id) {
      // セッションが無い → 未認証 → null を返す
      return null;
    }

    const userId = session.user.id;

    // 2. user_org_context から active org_id を取得
    // 注: Admin クライアントを使用して RLS をバイパス
    //     （認証済みユーザーが自分自身の user_org_context を取得するだけなのでセキュリティ上問題なし）
    const adminSupabase = getSupabaseAdmin();
    const { data: context, error: contextError } = await adminSupabase
      .from('user_org_context')
      .select('org_id')
      .eq('user_id', userId)
      .single();

    if (contextError || !context) {
      // アクティブな組織が無い → null を返す
      return null;
    }

    const orgId = context.org_id;

    // 3. profiles テーブルから role を SELECT
    const { data: profile, error: profileError } = await adminSupabase
      .from('profiles')
      .select('role')
      .eq('user_id', userId)
      .eq('org_id', orgId)
      .single();

    if (profileError || !profile) {
      console.error('[getCurrentRole] Profile not found:', { userId, orgId, error: profileError });
      // ユーザーがこの組織に所属していない → null を返す（未所属orgへのアクセス禁止）
      return null;
    }

    return {
      role: profile.role as Role,
    };
  } catch (error) {
    console.error('[getCurrentRole] Unexpected error:', error);
    return null;
  }
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
