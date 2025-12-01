# ドキュメント

このディレクトリには、プロジェクトの仕様書、設計決定、デプロイ手順、運用ガイドなどが含まれます。

## クイックリンク

### 新規開発者向け
- **[クイックスタート](./onboarding/quickstart.md)** - 最速でローカル開発環境を立ち上げる
- **[アーキテクチャ概要](./onboarding/architecture-overview.md)** - 設計判断の背景とCLAUDE.mdルールの理由
- **[新プロダクト追加ガイド](./onboarding/new-product-from-template.md)** - このスターター上に業務ドメインを載せる手順

### デプロイ
- **[Vercelセットアップ](./deployment/vercel-setup.md)** - 4プロジェクトの作成と環境変数設定
- **[ドメイン設定](./deployment/domain-configuration.md)** - DNS設定とCookie共有

### 運用
- **[監査ログガイド](./operations/activity-logs.md)** - ログ記録・閲覧・活用方法
- **[組織ライフサイクル](./operations/organization-lifecycle.md)** - 組織作成・凍結・廃止・owner譲渡

---

## ディレクトリ構成

- **onboarding/** - 開発者向けオンボーディング
  - `quickstart.md` - セットアップガイド（10分）
  - `architecture-overview.md` - 設計判断の背景
  - `new-product-from-template.md` - 新しいプロダクトをこのスターターに載せるときのガイド

- **deployment/** - デプロイ手順
  - `vercel-setup.md` - Vercel 4プロジェクト作成手順
  - `domain-configuration.md` - DNS設定・Cookie共有設定

- **operations/** - 運用ガイド
  - `activity-logs.md` - 監査ログの記録・閲覧・活用
  - `organization-lifecycle.md` - 組織管理（作成・凍結・廃止・owner譲渡）

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
  - `notifications.md` - 通知・メール送信の抽象レイヤーパターン
  - `cache-and-queue.md` - キャッシュ/キューの抽象レイヤーとRedis利用パターン
  - `storage-and-cdn.md` - 画像ストレージ/Cloudflare CDN利用パターン（直リンク禁止方針）

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
