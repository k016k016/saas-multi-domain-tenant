# ADR-006: Supabase Session Cookie 専用認証への移行

## 決定日
2025-10-31

## 決定
- **Cookie には Supabase Session Cookie のみを使用**する（`sb-<project-ref>-auth-token` 形式）
- **org_id / role を Cookie に保存しない**
- **すべての認証・認可情報は DB から取得**する（`user_org_context`, `profiles`, `organizations` テーブル）
- **旧 Cookie 管理コード (`@repo/config/src/cookies.ts`) は削除**し、将来の参照を ESLint で禁止

## ステータス
承認・実装済み

## コンテキスト
### 問題点
以前の実装では、認証情報を以下の2つの場所に保存していた:
1. Supabase Session Cookie（`sb-<project-ref>-auth-token`）← Supabase が自動管理
2. カスタム Cookie（`org_id`, `role`）← アプリケーション側で手動管理

この二重管理には以下の問題があった:
- **同期ずれのリスク**: DB の値が更新されても Cookie が古いまま残る
- **セキュリティリスク**: Cookie は改ざん可能で、署名検証がなければ信頼できない
- **Edge Runtime の制約**: middleware で Cookie の読み書きができても、DB アクセスができない
- **保守コストの増大**: Cookie と DB の二重管理が必要

### 検討した代替案
1. **Cookie に署名を追加** → 複雑性が増し、DB との同期問題は解決しない
2. **JWT に org_id/role を含める** → Supabase の Session トークンは変更不可
3. **Redis などのキャッシュレイヤー** → インフラが複雑化し、コスト増

## 決定内容の詳細

### 1. 認証フロー
```
ユーザーリクエスト
  ↓
middleware: Supabase Session Cookie の有無をチェック（認証済みか確認のみ）
  ↓
Server Component/Action: DB から org_id/role を取得
  ↓
RLS: PostgreSQL の Row Level Security で最終的なアクセス制御
```

### 2. 削除した実装
- `packages/config/src/cookies.ts` (171行) - 完全削除
  - `setSharedCookie()`, `getSharedCookie()` などの関数
  - org_id/role の Cookie 管理ロジック

### 3. middleware の役割
- **認証チェックのみ**: Supabase Session Cookie の存在確認
- **リダイレクト**: 未認証ユーザーを `/www/login` へ誘導
- **Edge Runtime 準拠**: DB アクセスなし、`next/headers` 使用なし

### 4. Server Component/Action の役割
- **DB 解決**: `getCurrentOrg()`, `getCurrentRole()` で最新の情報を取得
- **認可チェック**: ページごとに必要なロール/権限を検証
- **RLS 信頼**: 最終的なデータアクセス制御は PostgreSQL RLS に委譲

## 実装詳細

### DB 解決関数（`packages/config/src/auth.ts`）
```typescript
export async function getCurrentOrg(): Promise<OrgContext | null> {
  const supabase = await createServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) return null;

  const { data: context } = await supabase
    .from('user_org_context')
    .select('org_id')
    .eq('user_id', session.user.id)
    .single();

  if (!context) return null;

  const { data: org } = await supabase
    .from('organizations')
    .select('id, name')
    .eq('id', context.org_id)
    .single();

  return org ? { orgId: org.id, orgName: org.name } : null;
}
```

### middleware の実装（例: `apps/www/middleware.ts`）
```typescript
export function middleware(request: NextRequest) {
  // Supabase Session Cookie の存在確認のみ
  const hasSupabaseSession = Array.from(request.cookies.getAll()).some(
    cookie => cookie.name.startsWith('sb-') && cookie.name.includes('auth-token')
  );

  if (hasSupabaseSession && !pathname.startsWith('/www/login')) {
    return NextResponse.redirect(DOMAINS.app);
  }

  return NextResponse.next();
}
```

## ESLint による機械的強制

### `.eslintrc.json` に追加したルール
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
    }
  ]
}
```

## 影響範囲

### 変更されたファイル
- ❌ 削除: `packages/config/src/cookies.ts`
- ✅ 修正: `apps/www/middleware.ts` - org_id/role Cookie 参照を削除
- ✅ 追加: `.eslintrc.json` - ESLint ルール3つ
- ✅ 文書化: `working-log/2025-10-31.md` - 作業記録

### 影響を受けるコンポーネント
- **middleware**: Supabase Session Cookie のみ参照
- **Server Components**: `getCurrentOrg()`, `getCurrentRole()` を使用
- **Server Actions**: 同上、ActionResult パターンで遷移
- **E2E テスト**: 全 28 テスト、変更なしで通過 ✅

## セキュリティ上の利点

### Before（旧実装）
```
Cookie: org_id=abc123; role=admin  ← 改ざん可能、検証なし
↓
middleware で org_id/role を読み取り
↓
信頼してリダイレクトやアクセス制御を実施  ← 危険
```

### After（新実装）
```
Cookie: sb-<project-ref>-auth-token=<JWT>  ← Supabase が署名・検証
↓
middleware で認証状態のみ確認
↓
Server 側で DB から最新の org_id/role を取得  ← 信頼できる
↓
RLS で最終的なアクセス制御  ← 多層防御
```

## 検証

### セキュリティ監査結果（8項目すべて合格）
```bash
✅ 1. org_id/role Cookie書き込み: なし
✅ 2. 旧cookies.ts参照: なし
✅ 3. Server Action内のredirect(): なし
✅ 4. middlewareでのDB/headers import: なし
✅ 5. ActionResult型定義: あり
✅ 6. activity_logs実装: あり
✅ 7. DB解決関数: あり
✅ 8. ESLintガード: あり
```

### E2E テスト結果
```
28 passed (7.3s)
- ADMIN domain boundary テスト: 12件
- APP domain boundary テスト: 12件
- WWW login smoke テスト: 4件
```

## 今後の展開

### 推奨される開発パターン
1. **認証が必要な Page**: 必ず `getCurrentOrg()` / `getCurrentRole()` を呼び出す
2. **認可が必要な Page**: ロールチェック後、不正なら `notFound()` を返す
3. **組織切り替え**: `user_org_context` テーブルを UPDATE する Server Action を実装
4. **監査ログ**: すべての重要操作を `activity_logs` に記録

### 禁止事項（ESLint で自動検出）
- ❌ `@repo/config/src/cookies` のインポート
- ❌ middleware での `@repo/db` インポート
- ❌ middleware での `next/headers` インポート
- ❌ Server Action での `redirect()` 使用

## 参考資料
- [ADR-005: Edge Middleware と Node サーバ処理の分離](./ADR-005-edge-middleware-separation.md)
- [Supabase SSR Documentation](https://supabase.com/docs/guides/auth/server-side)
- [Next.js 16 Middleware](https://nextjs.org/docs/app/building-your-application/routing/middleware)
- working-log: `working-log/2025-10-31.md` - 実装の詳細な記録

## 補足: Cookie Domain の設定
Supabase Session Cookie はサブドメイン間で共有するため、`.local.test` ドメインを設定:

```typescript
// packages/db/src/index.ts
cookieStore.set(name, value, {
  ...options,
  domain: '.local.test', // サブドメイン間共有
});
```

これにより、`www.local.test` でログインすると `app.local.test` でも認証状態が共有される。
