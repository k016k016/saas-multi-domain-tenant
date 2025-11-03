# ドキュメント

このディレクトリには、プロジェクトの仕様書、設計決定、トラブルシューティングガイドなどが含まれます。

## ディレクトリ構成

- **spec/** - 仕様書
  - `tenancy.md` - マルチテナント仕様
  - `roles-and-access.md` - ロールとアクセス制御
  - `organization-switching.md` - 組織切替の仕様
  - `member-management.md` - メンバー管理の仕様

- **patterns/** - 実装パターン
  - `multi-domain.md` - マルチドメイン構成のパターン
  - `server-actions.md` - Server Actions の実装パターン
  - `e2e-testing.md` - E2Eテストのパターン
  - `e2e-test-templates.md` - E2Eテストテンプレート
  - `e2e-test-rules.md` - E2Eテスト追加ルール
  - `rls-testing.md` - RLSテストパターン
  - `edge-middleware.md` - Edge Middlewareパターン
  - `cookies-and-sessions.md` - Cookie/Sessionパターン
  - `authentication-authorization.md` - 認証・認可パターン

- **adr/** - アーキテクチャ決定記録 (ADR)
  - `ADR-005-edge-middleware-separation.md` - Edge Middleware と Node サーバ処理の分離
  - `ADR-006-supabase-session-only-authentication.md` - Supabase Session Cookie 専用認証への移行
  - `ADR-007-org-context-in-database.md` - 組織コンテキストのDB管理（Cookie禁止）

- **checklists/** - 実装チェックリスト（将来追加予定）
- **troubleshooting/** - トラブルシューティング（将来追加予定）

## 重要な原則

1. **責務分離** - 各ドメインは明確に分離され、統合は禁止
2. **権限境界** - ロール階層を厳守し、バイパスは許可しない
3. **マルチテナント** - org_id 単位でのアクセス制御は必須
4. **監査ログ** - 重要な操作は必ず activity_logs に記録
5. **RLS** - Row Level Security は必須であり、無効化は許可しない

詳細は各ファイルを参照してください。
