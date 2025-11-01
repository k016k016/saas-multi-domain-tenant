# Roadmap（v0 雛形）

本書は最小限の「現状（Done）／次にやること（Next）／終わりの定義（DoD）」のみを記載。
規範は README と既存ドキュメント（テナンシー・Cookie/Session・ADR-006）に準拠。

---

## ✅ Done（v0 Foundations）

- **モノレポ分離**: `www / app / admin / ops` を独立アプリとして配置
- **Edge-safe middleware**: DB/Supabase/`next/headers`/`cookies()` を未使用（`.github/workflows/ci.yml` で検証）
- **RLS前提のスキーマ**: `organizations / profiles / activity_logs` 実装済み（`infra/supabase/migrations/` でRLS導入）
- **Cookie方針の統一**: `sb-<project-ref>-auth-token` のみ使用（`docs/patterns/cookies-and-sessions.md`、`role/active org` は常にDB解決）
- **E2E基盤**: 境界（ドメイン×ロール）テストは通過状態まで到達（`e2e/tests/` 配下に実装）
- **Next.js 16対応**: Server Actions 側の `await cookies()` / `@repo/db` ビルド配布を適用済み（`packages/db/src/index.ts`）
- **activity_logs実装**: `packages/db/src/audit.ts` で `logActivity()` 実装済み（組織切替／ユーザー招待・ロール変更・削除で使用中）
- **組織切替の厳格化**: `apps/app/app/switch-org/actions.ts` で所属検証ロジック、`ActionResult` 形式返却、監査ログ記録を実装済み
- **共通認可ガード**: `packages/config/src/auth.ts` で `getCurrentOrg()`, `getCurrentRole()`, `hasRole()` 実装済み（ロール階層に基づく権限チェック）
- **CI自動化**: `.github/workflows/ci.yml` でEdge-safe検証、redirect()検出、E2E自動実行を実装済み（Playwrightによる本番ビルドテスト）

---

## ▶ Next（P0: 必須・安全性）

現在、P0タスクはすべて完了しています。

---

## ▶ Next（P1: 基礎機能）

- **admin/members CRUD（実DB/RLS）**: 招待→有効化、ロール変更、削除（監査ログ必須）
- **監査ログ閲覧（admin向け最小UI）**: 期間/ユーザー/アクションの簡易絞り込み
- **UX最小整備**: `/unauthorized` と `error.tsx`

---

## ▶ Next（P2: 運用/拡張）

- **Sentry 配線**: Server Actions失敗を capture（DSNのみ）
- **ops**: 当面プレースホルダ（将来 cross-org 読み取り限定）
- **ローカルSSO改善**: 必要なら Caddy/Nginx で 1ポート化を検証

---

## Release Gate（v0 / DoD）

- [x] `activity_logs`: 組織切替／ユーザーCRUD／ロール変更で INSERT が出る
- [x] 組織切替: 未所属orgは失敗・所属orgで成功（E2Eで確認）
- [x] 認可ガード: app=全員 / admin=admin|owner / owner専用=ownerのみ（403動作）
- [x] Server Actions: すべて `{ success, nextUrl }` 返却（`redirect()` 禁止）
- [x] Cookie: `sb-<project-ref>-auth-token` のみ（`role/active org` はDB解決）
- [x] middleware: Edge-safe（DB/`@supabase/*`/`next/headers`/`cookies()` 不使用）※CI で自動検証
- [x] CI: E2E とゲート検証が main/develop で自動実行（`.github/workflows/ci.yml`）

---

## 変更管理

- ポリシー変更は ADR（例：ADR-006）へ追記し、規範本文は README 側に寄せて DRY を維持する。
