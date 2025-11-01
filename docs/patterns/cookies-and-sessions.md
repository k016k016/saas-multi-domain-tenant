# Cookies & Sessions（Next.js 16 / Supabase） — 最小ポリシー

対象: www / app / admin / ops の全アプリ、Server Actions、E2E、運用。

## 0. 結論（これだけ守ればよい）
- **Cookieは Supabase セッションのみ**: `sb-*-auth-token`形式（Supabaseが自動管理）
  - 注: 実際の Cookie 名は `sb-<project-ref>-auth-token` の形式
  - `sb-access-token` / `sb-refresh-token` という名前ではない
- **禁止**: `role` / `active org` を Cookie に保存・参照
- **active org は DBで保持**（例: `user_org_context`）、毎リクエストDBで解決
- **Server Action** は `redirect()`禁止。**`{ success, nextUrl }`** を返し、クライアントで遷移
- **middleware（Edge）** は Edge-safe 限定（DB/`next/headers`/Supabase禁止）
- **Next.js 16**: `await cookies()` を徹底

**関連ADR**:
- [ADR-006: Supabase Session Cookie 専用認証への移行](../adr/ADR-006-supabase-session-only-authentication.md)
- [ADR-007: 組織コンテキストのDB管理（Cookie禁止）](../adr/ADR-007-org-context-in-database.md)

## 1. Cookie仕様
本番（production）
- `HttpOnly` / `Secure` / `SameSite=Lax` / `Domain=.example.com`

開発（dev / E2E）
- `HttpOnly` / `Secure=false` / `SameSite=Lax` / `Domain=.local.test`
- ドメインは **サブドメイン（www/app/admin/ops）を共通の eTLD+1** に揃える

> 注: サブドメイン間は **same-site** なので `Lax` で共有可能。異なるポートでも **Cookie自体は共有される**が、**ブラウザ拡張やCORS設定で跨ぎ挙動が壊れることがある**ため、E2Eは storageState を併用推奨。

## 2. コンテキストの決定（DBベース）
- `role`: `profiles` から取得（`SELECT role FROM profiles WHERE id=$user AND org_id=$active_org`）
- `active org`: `user_org_context` から取得／切替は `UPDATE`
  ```sql
  create table if not exists user_org_context (
    user_id uuid primary key,
    org_id  uuid not null,
    updated_at timestamptz not null default now()
  );
  -- TODO: RLS（本人のみ、自組織のみ）
  ```

	•	RLS前提: すべてのSELECT/INSERT/UPDATE/DELETEで org_id と本人/権限を検証

3. Server Actions — 契約
	•	返却型:

```ts
export type ActionResult<T = undefined> =
  | { success: true; data?: T; nextUrl?: string }
  | { success: false; error: string; nextUrl?: string }
```

	•	禁止: redirect()
	•	可: return { success: true, nextUrl: '/dashboard' }
	•	Next 16: await cookies()（同期APIは不可）
	•	監査: 組織切替・ユーザーCRUD・権限変更・支払い変更・凍結/廃止・owner譲渡は activity_logs に記録

（参考）Cookie書き込みの最小例

```ts
const jar = await cookies()
const domain = process.env.COOKIE_DOMAIN ?? '.local.test'
const isProd = process.env.NODE_ENV === 'production'
const common = { httpOnly: true, path: '/', sameSite: 'lax', secure: isProd, domain }

// sb-以外は書かない
jar.set({ name: 'sb-access-token',  value: session.access_token,  ...common })
jar.set({ name: 'sb-refresh-token', value: session.refresh_token, ...common })
```

4. middleware（Edge）— 禁止事項
	•	禁止: DB接続、@supabase/*、@repo/db、next/headers、cookies()
	•	許容: ドメイン判定、軽い 401/403/302、パスのガード（文字列判定のみ）

5. 監査（activity_logs）
	•	最小列: org_id, user_id, action, payload(jsonb), created_at
	•	RLS対象（他組織は不可視）
	•	必須記録: 組織切替／ユーザーCRUD／権限変更／支払い変更／凍結・廃止／owner譲渡

6. よくある落とし穴（短く）
	•	Domain がサブドメインではなく 親ドメイン（eTLD+1） になっていない
	•	devで Secure=true のまま → localhost扱いで弾かれる
	•	ポート違いとCORS/Proxyの組合せで「見えているのに読めない」状態
	•	redirect() を混ぜてクライアント遷移と二重遷移になる
	•	await cookies() を忘れて Next 16 でランタイムエラー

7. 変更履歴
	•	v0.3 (2025-10-31): 旧Cookie管理コード（`@repo/config/src/cookies.ts`）を完全削除 / ESLintルールで機械的に強制 / Cookie名を実際の形式（`sb-<project-ref>-auth-token`）に明記 / ADR-006, ADR-007を追加
	•	v0.2: Cookieは sb-セッションのみ／role・active org のCookie保存廃止／active orgはDB保持に統一／Server Actionは { success, nextUrl } へ統一／Next16の await cookies() を前提化

## 参考資料
- [ADR-005: Edge Middleware と Node サーバ処理の分離](../adr/ADR-005-edge-middleware-separation.md)
- [ADR-006: Supabase Session Cookie 専用認証への移行](../adr/ADR-006-supabase-session-only-authentication.md)
- [ADR-007: 組織コンテキストのDB管理（Cookie禁止）](../adr/ADR-007-org-context-in-database.md)
- [認証・認可パターン](./authentication-authorization.md)
- [セキュリティ監査チェックリスト](../checklists/security-audit.md)

---

## 追記（リンクだけの最小修正）

### `docs/spec/tenancy.md` — 冒頭か「セッションと組織コンテキスト」節の末尾に1行追記
```md
詳細ルールは `docs/patterns/cookies-and-sessions.md` を参照。
```

CONTRIBUTING_AI.md — 既存ルール節に1行追記

```md
Cookie/Sessionの細則は `docs/patterns/cookies-and-sessions.md` を必読。
```


⸻

反対に“作らない”判断をする条件
	•	将来変更が少ない（ほぼ凍結）かつ、tenancy.md の1節で十分に短い場合。
	•	レビュー/エージェントにこのトピックだけ共有する場面がない場合。

現状は参照頻度が高い中核ルール。別立てにしておく方がミスも衝突も減ります。作るのを推します。
