# セキュリティ監査チェックリスト

このチェックリストは、アプリケーションのセキュリティ要件を満たしているかを確認するためのものです。

## 目次
- [自動監査コマンド](#自動監査コマンド)
- [チェック項目](#チェック項目)
- [監査の実施方法](#監査の実施方法)
- [修正方法](#修正方法)

## 自動監査コマンド

以下のコマンドを実行すると、8つのセキュリティ要件を自動的にチェックできます：

```bash
echo "=== セキュリティ監査 最終レポート ===" && \
echo "" && \
echo "✅ 1. org_id/role Cookie書き込み:" && \
(rg -n "setSharedCookie\(['\"](role|org_id)['\"]" -g '!node_modules' || echo "   なし（合格）") && \
echo "" && \
echo "✅ 2. 旧cookies.ts参照:" && \
(rg -n "from .*/cookies" packages apps || echo "   なし（合格）") && \
echo "" && \
echo "✅ 3. Server Action内のredirect():" && \
(rg "^import.*redirect.*from.*next/navigation" apps/**/app/**/actions.ts 2>/dev/null || echo "   なし（合格）") && \
echo "" && \
echo "✅ 4. middlewareでのDB/headers import:" && \
(rg -n "from ['\"]@repo/db|from ['\"]next/headers" apps/**/middleware.ts || echo "   なし（合格）") && \
echo "" && \
echo "✅ 5. ActionResult型定義:" && \
rg -n "type ActionResult" packages/config/src/types.ts && \
echo "" && \
echo "✅ 6. activity_logs実装:" && \
(rg -l "activity_logs" packages/db/src/audit.ts infra/supabase/migrations/*.sql | head -3) && \
echo "" && \
echo "✅ 7. DB解決関数:" && \
(rg -l "getCurrentOrg|getCurrentRole" packages/config/src/auth.ts) && \
echo "" && \
echo "✅ 8. ESLintガード:" && \
grep -A3 "no-restricted-imports" .eslintrc.json | head -10
```

## チェック項目

### 1. Cookie管理

#### 1.1 Supabase Session Cookie のみを使用
- [ ] Cookie に `org_id` や `role` を保存していない
- [ ] Supabase Session Cookie (`sb-<project-ref>-auth-token`) のみを使用
- [ ] Cookie domain は `.local.test` に設定されている

**確認コマンド:**
```bash
# org_id/role の Cookie 書き込みがないか確認
rg -n "setSharedCookie\(['\"](role|org_id)['\"]" -g '!node_modules'

# 期待結果: 何も出力されない（合格）
```

#### 1.2 旧 Cookie 管理コードの削除
- [ ] `packages/config/src/cookies.ts` が存在しない
- [ ] どこからも `@repo/config/src/cookies` をインポートしていない

**確認コマンド:**
```bash
# 旧 cookies.ts への参照がないか確認
rg -n "from .*/cookies" packages apps

# 期待結果: 何も出力されない（合格）
```

### 2. 認証・認可

#### 2.1 DB からの認証情報取得
- [ ] `getCurrentOrg()` 関数が実装されている
- [ ] `getCurrentRole()` 関数が実装されている
- [ ] これらの関数は DB からデータを取得している

**確認コマンド:**
```bash
# DB 解決関数の存在確認
rg -l "getCurrentOrg|getCurrentRole" packages/config/src/auth.ts

# 期待結果: packages/config/src/auth.ts が出力される
```

#### 2.2 RLS (Row Level Security) の実装
- [ ] すべてのテーブルに RLS が有効化されている
- [ ] 適切なポリシーが設定されている
- [ ] テストでRLSポリシーが検証されている

**確認コマンド:**
```bash
# RLS テストの存在確認
ls -la e2e/tests/rls/

# マイグレーションファイルで RLS 有効化を確認
rg "ALTER TABLE.*ENABLE ROW LEVEL SECURITY" infra/supabase/migrations/
```

### 3. Server Actions

#### 3.1 ActionResult パターン
- [ ] `ActionResult<T>` 型が定義されている
- [ ] すべての Server Actions が `ActionResult` を返す
- [ ] `redirect()` を使用していない

**確認コマンド:**
```bash
# ActionResult 型定義の確認
rg -n "type ActionResult" packages/config/src/types.ts

# redirect() の使用がないか確認
rg "^import.*redirect.*from.*next/navigation" apps/**/app/**/actions.ts

# 期待結果: redirect のインポートが見つからない（合格）
```

#### 3.2 エラーハンドリング
- [ ] すべての Server Actions で `try-catch` を使用
- [ ] エラー時に `{ success: false, error }` を返す
- [ ] 成功時に `{ success: true, data?, nextUrl? }` を返す

**確認例:**
```typescript
export async function deleteUser(userId: string): Promise<ActionResult<void>> {
  try {
    const roleContext = await getCurrentRole();
    if (!roleContext || roleContext.role !== 'owner') {
      return { success: false, error: 'Unauthorized' };
    }

    // DB操作
    const { error } = await supabase.from('profiles').delete().eq('id', userId);
    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, nextUrl: '/members' };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}
```

### 4. Middleware

#### 4.1 Edge Runtime 準拠
- [ ] middleware で `@repo/db` をインポートしていない
- [ ] middleware で `next/headers` をインポートしていない
- [ ] middleware は認証チェックのみ行う

**確認コマンド:**
```bash
# middleware での DB/headers import がないか確認
rg -n "from ['\"]@repo/db|from ['\"]next/headers" apps/**/middleware.ts

# 期待結果: 何も出力されない（合格）
```

#### 4.2 認証チェックのみ実施
- [ ] Supabase Session Cookie の存在確認のみ
- [ ] 認可チェック（role確認など）は行わない
- [ ] 未認証の場合のみリダイレクト

**正しい実装例:**
```typescript
export function middleware(request: NextRequest) {
  const hasSupabaseSession = Array.from(request.cookies.getAll()).some(
    cookie => cookie.name.startsWith('sb-') && cookie.name.includes('auth-token')
  );

  if (!hasSupabaseSession) {
    return NextResponse.redirect(new URL('/www/login', DOMAINS.WWW));
  }

  return NextResponse.next();
}
```

### 5. ESLint ガード

#### 5.1 ESLint ルールの設定
- [ ] `.eslintrc.json` に `no-restricted-imports` ルールがある
- [ ] 旧 Cookie 管理のインポートを禁止
- [ ] middleware での DB/headers インポートを禁止
- [ ] Server Action での redirect インポートを禁止

**確認コマンド:**
```bash
# ESLint ルールの確認
grep -A3 "no-restricted-imports" .eslintrc.json | head -10
```

**期待される設定:**
```json
{
  "rules": {
    "no-restricted-imports": [
      "error",
      {
        "paths": [{
          "name": "@repo/config/src/cookies",
          "message": "旧Cookie管理は禁止。Supabaseセッションのみを使用してください。"
        }]
      }
    ]
  },
  "overrides": [
    {
      "files": ["apps/**/middleware.ts"],
      "rules": {
        "no-restricted-imports": [
          "error",
          { "patterns": ["@repo/db*", "next/headers"] }
        ]
      }
    },
    {
      "files": ["apps/**/app/**/actions.ts"],
      "rules": {
        "no-restricted-imports": [
          "error",
          {
            "paths": [{
              "name": "next/navigation",
              "importNames": ["redirect"]
            }]
          }
        ]
      }
    }
  ]
}
```

### 6. 監査ログ

#### 6.1 activity_logs テーブル
- [ ] `activity_logs` テーブルが存在する
- [ ] マイグレーションファイルに定義がある
- [ ] audit.ts に記録関数が実装されている

**確認コマンド:**
```bash
# activity_logs 実装の確認
rg -l "activity_logs" packages/db/src/audit.ts infra/supabase/migrations/*.sql | head -3
```

#### 6.2 監査ログの記録
- [ ] 重要な操作（削除、権限変更など）で監査ログを記録
- [ ] `user_id`, `org_id`, `action`, `resource_type` を記録
- [ ] Server Action から呼び出し可能

### 7. テスト

#### 7.1 E2E テスト
- [ ] すべての E2E テストが通過する
- [ ] 認証・認可のテストがある
- [ ] ドメイン境界のテストがある

**確認コマンド:**
```bash
# E2E テスト実行
pnpm test:e2e

# 期待結果: 28 passed
```

#### 7.2 RLS テスト
- [ ] RLS ポリシーのテストがある
- [ ] 組織間のデータ漏洩がないことを確認
- [ ] ロール別のアクセス制御を確認

**確認コマンド:**
```bash
# RLS テスト実行
pnpm test:e2e e2e/tests/rls/
```

### 8. 環境設定

#### 8.1 環境変数
- [ ] `.env.local` に Supabase URL/Key が設定されている
- [ ] `.env.test` に E2E テスト用の設定がある
- [ ] 本番用の環境変数が適切に管理されている

#### 8.2 /etc/hosts の設定
- [ ] `127.0.0.1 www.local.test` が設定されている
- [ ] `127.0.0.1 app.local.test` が設定されている
- [ ] `127.0.0.1 admin.local.test` が設定されている
- [ ] `127.0.0.1 ops.local.test` が設定されている

**確認コマンド:**
```bash
# /etc/hosts の確認
grep "local.test" /etc/hosts
```

## 監査の実施方法

### 定期監査
1. **週次**: 自動監査コマンドを実行
2. **リリース前**: 全チェック項目を手動で確認
3. **セキュリティインシデント後**: 緊急監査を実施

### CI/CD での監査
```yaml
# .github/workflows/security-audit.yml
name: Security Audit

on: [push, pull_request]

jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run ESLint
        run: pnpm lint
      - name: Check for banned imports
        run: |
          if rg "setSharedCookie\(['\"](role|org_id)['\"]" -g '!node_modules'; then
            echo "ERROR: Found org_id/role Cookie writes"
            exit 1
          fi
      - name: Run E2E Tests
        run: pnpm test:e2e
```

## 修正方法

### 問題1: org_id/role Cookie が見つかった

**検出例:**
```bash
$ rg "setSharedCookie\(['\"](role|org_id)['\"]"
apps/www/app/login/actions.ts:42:  setSharedCookie('org_id', orgId);
```

**修正方法:**
1. Cookie 設定コードを削除
2. DB から取得するように変更
```typescript
// ❌ 悪い例
setSharedCookie('org_id', orgId);

// ✅ 良い例
// Cookie は設定しない。Server Component で取得:
const orgContext = await getCurrentOrg();
```

### 問題2: middleware で DB アクセスしている

**検出例:**
```bash
$ rg "from ['\"]@repo/db" apps/**/middleware.ts
apps/app/middleware.ts:3:import { createServerClient } from '@repo/db';
```

**修正方法:**
1. middleware から DB 関連のインポートを削除
2. 認証チェックのみに変更
```typescript
// ❌ 悪い例
import { createServerClient } from '@repo/db';
const { data } = await supabase.from('profiles').select('role');

// ✅ 良い例
const hasSession = Array.from(request.cookies.getAll()).some(
  cookie => cookie.name.startsWith('sb-')
);
```

### 問題3: Server Action で redirect() を使用

**検出例:**
```bash
$ rg "^import.*redirect.*from.*next/navigation" apps/**/app/**/actions.ts
apps/admin/app/members/actions.ts:2:import { redirect } from 'next/navigation';
```

**修正方法:**
1. redirect のインポートを削除
2. ActionResult を返すように変更
```typescript
// ❌ 悪い例
import { redirect } from 'next/navigation';
export async function createMember() {
  // ... 処理 ...
  redirect('/members');
}

// ✅ 良い例
import type { ActionResult } from '@repo/config/types';
export async function createMember(): Promise<ActionResult<Member>> {
  // ... 処理 ...
  return {
    success: true,
    data: newMember,
    nextUrl: '/members',
  };
}
```

## 参考資料
- [ADR-005: Edge Middleware と Node サーバ処理の分離](../adr/ADR-005-edge-middleware-separation.md)
- [ADR-006: Supabase Session Cookie 専用認証への移行](../adr/ADR-006-supabase-session-only-authentication.md)
- [ADR-007: 組織コンテキストのDB管理（Cookie禁止）](../adr/ADR-007-org-context-in-database.md)
- [認証・認可パターン](../patterns/authentication-authorization.md)
- [Server Actions チェックリスト](./server-action-checklist.md)

## 監査履歴

### 2025-10-31: 初回セキュリティ強化
- 旧 Cookie 管理コードを削除
- ESLint ルールを追加
- 全 8 項目で合格 ✅
- E2E テスト: 28/28 passed
