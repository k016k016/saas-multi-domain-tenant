# ADR-005: Edge Middleware と Node サーバ処理の分離

## 決定
- middleware は **Edge Runtime 前提**。**DB/Supabase/`cookies()` を使わない**。
- middleware が import してよいのは **@repo/config-edge（純関数のみ）**。
- DB や認可の本検証は **Route Handler / Server Actions / Page (nodejs runtime)** 側で行う。
- `redirect()` は Server Action では禁止。**{ success, nextUrl }** を返し、クライアントで遷移。

## 根拠
- Edge は Node 依存（pg/crypto等）を解決できない。
- 認可は最終的に RLS + サーバ側検証で担保すべき（Cookieはヒント）。

## 影響
- `@repo/db` を middleware から import する実装は禁止。
- ESLint/CI で機械強制する。

## 代替案の却下理由
- 「@repo/db をビルドして Edge で使う」は根本解決にならない（Node依存のまま）。

## 実装メモ
- 各アプリ `next.config.mjs` に `transpilePackages: ['@repo/config-edge']` を設定。
- サーバ側で Supabase を使うファイルは `export const runtime = 'nodejs'` を明記。


## 付録A: Cookie/API方針（Next.js 16）

- `cookies()` は **async**。Server Action / Route Handler / RSC では **必ず await** して取得する。
- **middleware** は Edge Runtime のため `next/headers` は使わず、`NextRequest/NextResponse` の `cookies` を使う。
- 認可はサーバ側（Node Runtime）で再検証する。Cookieは**ヒント**であり、**信頼しない**。
- Server Action は **redirect() 禁止**。`{ success, nextUrl }` を返し、クライアントで遷移する。

