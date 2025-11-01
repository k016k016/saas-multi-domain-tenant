# 認証・認可に関するトラブルシューティング

このドキュメントでは、認証（Authentication）・認可（Authorization）に関する一般的な問題とその解決方法を説明します。

## 目次
- [ログイン・認証の問題](#ログイン認証の問題)
- [認可・アクセス制御の問題](#認可アクセス制御の問題)
- [Cookie・セッションの問題](#cookieセッションの問題)
- [組織切り替えの問題](#組織切り替えの問題)
- [middleware の問題](#middleware-の問題)
- [デバッグ方法](#デバッグ方法)

## ログイン・認証の問題

### 問題1: ログイン後にリダイレクトされない

**症状**: ログインフォームで正しい credentials を入力しても `/www/login` にとどまる

**原因の可能性:**
1. Supabase Session Cookie が設定されていない
2. Cookie domain が正しく設定されていない
3. /etc/hosts に `.local.test` ドメインが設定されていない

**解決方法:**

#### 手順1: Cookie が設定されているか確認
```bash
# ブラウザの開発者ツール → Application → Cookies で確認
# sb-<project-ref>-auth-token が存在するか
```

#### 手順2: Cookie domain の確認
`packages/db/src/index.ts` を確認:
```typescript
// 正しい設定
cookieStore.set(name, value, {
  ...options,
  domain: '.local.test', // ← これが必要
});
```

#### 手順3: /etc/hosts の設定を確認
```bash
# /etc/hosts に以下が設定されているか確認
cat /etc/hosts | grep local.test

# 期待される出力:
# 127.0.0.1 www.local.test
# 127.0.0.1 app.local.test
# 127.0.0.1 admin.local.test
# 127.0.0.1 ops.local.test
```

設定されていない場合は追加:
```bash
sudo vi /etc/hosts

# 以下を追加:
127.0.0.1 www.local.test
127.0.0.1 app.local.test
127.0.0.1 admin.local.test
127.0.0.1 ops.local.test
```

#### 手順4: dev サーバーの再起動
```bash
# プロセスを停止
pkill -9 -f "pnpm dev"

# キャッシュをクリア
rm -rf apps/*/.next .turbo

# 再起動
pnpm dev
```

### 問題2: "Error: Invalid login credentials" が表示される

**症状**: ログイン時に認証エラーが返される

**原因の可能性:**
1. メールアドレスまたはパスワードが間違っている
2. ユーザーが Supabase に登録されていない
3. 環境変数が正しく設定されていない

**解決方法:**

#### 手順1: Supabase Dashboard でユーザーを確認
1. https://supabase.com/dashboard にアクセス
2. プロジェクトを選択
3. Authentication → Users で対象ユーザーが存在するか確認

#### 手順2: 環境変数の確認
```bash
# .env.local の内容を確認
cat .env.local | grep SUPABASE

# 以下が設定されているか確認:
# NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
# NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
```

#### 手順3: テストユーザーの作成
```bash
# E2E テスト用のシードスクリプトを実行
pnpm db:seed
```

### 問題3: ログアウト後も認証状態が残る

**症状**: ログアウトしても `/app` にアクセスできる

**原因**: Session Cookie が削除されていない

**解決方法:**

#### 手順1: ログアウト実装の確認
```typescript
// apps/www/app/www/login/actions.ts
export async function logout(): Promise<ActionResult<void>> {
  const supabase = await createServerClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    return { success: false, error: error.message };
  }

  return {
    success: true,
    nextUrl: '/www/login',
  };
}
```

#### 手順2: 手動で Cookie を削除
ブラウザの開発者ツール → Application → Cookies → `sb-<project-ref>-auth-token` を削除

## 認可・アクセス制御の問題

### 問題4: member が admin ページにアクセスできてしまう

**症状**: `member` ロールのユーザーが `/admin` にアクセスできる

**原因の可能性:**
1. Server Component で認可チェックが実装されていない
2. RLS ポリシーが正しく設定されていない

**解決方法:**

#### 手順1: Server Component で認可チェックを追加
```typescript
// apps/admin/app/members/page.tsx
import { getCurrentRole } from '@repo/config';
import { notFound } from 'next/navigation';

export default async function MembersPage() {
  const roleContext = await getCurrentRole();

  // 認可チェック
  if (!roleContext || roleContext.role !== 'owner') {
    notFound(); // 404 を返す
  }

  return <MembersContent />;
}
```

#### 手順2: RLS ポリシーの確認
```sql
-- profiles テーブルの RLS ポリシー確認
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'profiles';
```

#### 手順3: E2E テストで検証
```bash
# Admin boundary テストを実行
pnpm test:e2e e2e/tests/admin/boundary.spec.ts

# member → 404 のテストが通るか確認
```

### 問題5: 組織外のデータが見えてしまう

**症状**: 他の組織のデータにアクセスできる

**原因**: RLS ポリシーが正しく動作していない

**解決方法:**

#### 手順1: RLS が有効化されているか確認
```sql
-- テーブルの RLS 設定を確認
SELECT
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public';

-- rowsecurity が 't' (true) であるべき
```

#### 手順2: RLS ポリシーの修正
```sql
-- 例: organizations テーブルのポリシー
CREATE POLICY "Users can only see their org"
  ON organizations FOR SELECT
  USING (
    id IN (
      SELECT org_id
      FROM user_org_context
      WHERE user_id = auth.uid()
    )
  );
```

#### 手順3: RLS テストの実行
```bash
pnpm test:e2e e2e/tests/rls/
```

## Cookie・セッションの問題

### 問題6: サブドメイン間で Session が共有されない

**症状**: `www.local.test` でログインしても `app.local.test` で認証されない

**原因**: Cookie domain が `.local.test` に設定されていない

**解決方法:**

#### 手順1: Cookie domain の設定を確認
`packages/db/src/index.ts`:
```typescript
export async function createServerClient() {
  const cookieStore = await cookies();

  return createSupabaseServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, {
                ...options,
                domain: '.local.test', // ← この設定が必要
              })
            );
          } catch {
            // Server Component 内での set は無視
          }
        },
      },
    }
  );
}
```

#### 手順2: Cookie の確認
ブラウザの開発者ツールで Cookie の Domain が `.local.test` になっているか確認

### 問題7: org_id/role が Cookie に保存されている

**症状**: セキュリティ監査で `org_id` や `role` の Cookie が見つかる

**原因**: 旧実装の Cookie 管理コードが残っている

**解決方法:**

#### 手順1: 旧コードの検索
```bash
# org_id/role Cookie の書き込みを検索
rg "setSharedCookie\(['\"](role|org_id)['\"]" -g '!node_modules'

# 旧 cookies.ts のインポートを検索
rg "from .*/cookies" packages apps
```

#### 手順2: 旧コードの削除
見つかったコードを削除し、DB から取得するように変更:
```typescript
// ❌ 悪い例
setSharedCookie('org_id', orgId);

// ✅ 良い例
// Cookie は設定しない
// Server Component で取得:
const orgContext = await getCurrentOrg();
```

#### 手順3: ESLint で検出
```bash
pnpm lint
```

## 組織切り替えの問題

### 問題8: 組織切り替え後に古いデータが表示される

**症状**: `switchOrganization()` 実行後も古い組織のデータが表示される

**原因**: キャッシュされたデータが残っている

**解決方法:**

#### 手順1: revalidatePath() の追加
```typescript
import { revalidatePath } from 'next/cache';

export async function switchOrganization(
  newOrgId: string
): Promise<ActionResult<void>> {
  const supabase = await createServerClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.user?.id) {
    return { success: false, error: 'Not authenticated' };
  }

  // user_org_context を UPDATE
  const { error } = await supabase
    .from('user_org_context')
    .update({ org_id: newOrgId, updated_at: new Date().toISOString() })
    .eq('user_id', session.user.id);

  if (error) {
    return { success: false, error: error.message };
  }

  // キャッシュをクリア
  revalidatePath('/'); // ← これが必要

  return {
    success: true,
    nextUrl: '/',
  };
}
```

#### 手順2: クライアント側でリロード
```typescript
// Client Component
const result = await switchOrganization(newOrgId);
if (result.success) {
  router.push(result.nextUrl);
  router.refresh(); // ← キャッシュをクリア
}
```

### 問題9: 組織切り替えが user_org_context に反映されない

**症状**: DB の `user_org_context` テーブルが更新されない

**原因**: RLS ポリシーで UPDATE が許可されていない

**解決方法:**

#### 手順1: RLS ポリシーの確認
```sql
-- user_org_context の UPDATE ポリシーを確認
SELECT *
FROM pg_policies
WHERE tablename = 'user_org_context'
  AND cmd = 'UPDATE';
```

#### 手順2: ポリシーの修正
```sql
-- UPDATE ポリシーを追加
CREATE POLICY "Users can update their own context"
  ON user_org_context FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

## middleware の問題

### 問題10: middleware で "Cannot access DB" エラー

**症状**: middleware で `getCurrentRole()` を呼ぶとエラーになる

**原因**: Edge Runtime は Node.js API にアクセスできない

**解決方法:**

#### middleware から DB アクセスを削除
```typescript
// ❌ 悪い例
export async function middleware(request: NextRequest) {
  const role = await getCurrentRole(); // エラー
  if (role !== 'owner') {
    return NextResponse.redirect('/');
  }
}

// ✅ 良い例
export function middleware(request: NextRequest) {
  // 認証チェックのみ
  const hasSession = Array.from(request.cookies.getAll()).some(
    cookie => cookie.name.startsWith('sb-') && cookie.name.includes('auth-token')
  );

  if (!hasSession) {
    return NextResponse.redirect(new URL('/www/login', DOMAINS.WWW));
  }

  return NextResponse.next();
}

// 認可チェックは Server Component で
export default async function Page() {
  const roleContext = await getCurrentRole(); // ✅ OK
  if (!roleContext || roleContext.role !== 'owner') {
    notFound();
  }
}
```

### 問題11: ESLint エラー: "Import of @repo/db is not allowed"

**症状**: middleware で `@repo/db` をインポートすると ESLint エラー

**原因**: ESLint ルールで middleware での DB インポートが禁止されている

**解決方法:**

これは正しい動作です。middleware から DB インポートを削除してください:
```typescript
// ❌ 悪い例
import { createServerClient } from '@repo/db';

// ✅ 良い例
// middleware では DB を使わない
```

## デバッグ方法

### デバッグ1: 認証状態の確認

#### Server Component での確認
```typescript
export default async function DebugPage() {
  const supabase = await createServerClient();
  const { data: { session } } = await supabase.auth.getSession();

  const orgContext = await getCurrentOrg();
  const roleContext = await getCurrentRole();

  return (
    <div>
      <h1>Debug Info</h1>
      <pre>
        {JSON.stringify({
          userId: session?.user?.id,
          email: session?.user?.email,
          orgId: orgContext?.orgId,
          orgName: orgContext?.orgName,
          role: roleContext?.role,
        }, null, 2)}
      </pre>
    </div>
  );
}
```

### デバッグ2: Cookie の確認

#### ブラウザの開発者ツール
1. F12 で開発者ツールを開く
2. Application タブ → Cookies
3. `sb-<project-ref>-auth-token` が存在するか確認（project-ref は実際のプロジェクトID）
4. Domain が `.local.test` になっているか確認

### デバッグ3: RLS ポリシーのテスト

#### SQL で直接テスト
```sql
-- ユーザーとして実行
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims.sub = 'user-id-here';

-- SELECT を試す
SELECT * FROM organizations;

-- 期待: そのユーザーの組織のみ返される
```

### デバッグ4: ログの確認

#### Server Component でログ出力
```typescript
export default async function Page() {
  const orgContext = await getCurrentOrg();
  console.log('[DEBUG] orgContext:', orgContext);

  const roleContext = await getCurrentRole();
  console.log('[DEBUG] roleContext:', roleContext);

  // ...
}
```

ログはターミナル（dev サーバー側）に出力されます。

### デバッグ5: E2E テストでの検証

```bash
# 特定のテストを実行
pnpm test:e2e e2e/tests/admin/boundary.spec.ts

# ヘッドレスモードをオフにして視覚的に確認
pnpm test:e2e:ui
```

## 参考資料
- [ADR-005: Edge Middleware と Node サーバ処理の分離](../adr/ADR-005-edge-middleware-separation.md)
- [ADR-006: Supabase Session Cookie 専用認証への移行](../adr/ADR-006-supabase-session-only-authentication.md)
- [ADR-007: 組織コンテキストのDB管理（Cookie禁止）](../adr/ADR-007-org-context-in-database.md)
- [認証・認可パターン](../patterns/authentication-authorization.md)
- [セキュリティ監査チェックリスト](../checklists/security-audit.md)
- [Server Action redirect トラブルシューティング](./server-action-redirect.md)

## 緊急時の対応

### 全ユーザーがログインできない場合

1. Supabase Dashboard で API Status を確認
2. 環境変数（SUPABASE_URL, SUPABASE_ANON_KEY）を確認
3. dev サーバーを再起動
4. ブラウザのキャッシュをクリア

### セキュリティインシデントの疑いがある場合

1. すぐに working-log に記録
2. セキュリティ監査を実行
3. RLS ポリシーを確認
4. 必要に応じてセッションを無効化

```sql
-- すべてのセッションを無効化（緊急時のみ）
DELETE FROM auth.sessions;
```
