# ドキュメント

このディレクトリには、プロジェクトの仕様書、設計決定、トラブルシューティングガイドなどが含まれます。

## ディレクトリ構成

- **spec/** - 仕様書
  - `tenancy.md` - マルチテナント仕様
  - `roles-and-access.md` - ロールとアクセス制御（将来追加予定）
  - `organization-switching.md` - 組織切替の仕様（将来追加予定）

- **patterns/** - 実装パターン（将来追加予定）
  - `multi-domain.md` - マルチドメイン構成のパターン
  - `server-actions.md` - Server Actions の実装パターン
  - `e2e-testing.md` - E2Eテストのパターン

- **checklists/** - 実装チェックリスト（将来追加予定）
  - `pre-implementation.md` - 実装前チェックリスト
  - `server-action-checklist.md` - Server Action実装チェックリスト
  - `e2e-test-checklist.md` - E2Eテスト実装チェックリスト

- **decisions/** - アーキテクチャ決定記録 (ADR)（将来追加予定）
  - `001-multi-domain-architecture.md` - マルチドメイン構成の採用理由
  - `003-e2e-auth-bypass.md` - E2Eテスト用認証バイパス

- **troubleshooting/** - トラブルシューティング（将来追加予定）
  - `server-action-redirect.md` - Server Actionでのリダイレクト問題

## 重要な原則

1. **責務分離** - 各ドメインは明確に分離され、統合は禁止
2. **権限境界** - ロール階層を厳守し、バイパスは許可しない
3. **マルチテナント** - org_id 単位でのアクセス制御は必須
4. **監査ログ** - 重要な操作は必ず activity_logs に記録
5. **RLS** - Row Level Security は必須であり、無効化は許可しない

詳細は各ファイルを参照してください。
