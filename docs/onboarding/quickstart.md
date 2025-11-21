# クイックスタートガイド

新規開発者向けのセットアップガイド。最速でローカル開発環境を立ち上げます。

---

## 前提条件

- **Node.js**: v18以上（推奨: v20）
- **pnpm**: v8以上（`npm install -g pnpm`）
- **Git**: バージョン管理
- **Supabaseアカウント**: https://supabase.com で無料登録

---

## セットアップ（10分）

### 1. リポジトリをクローン

```bash
git clone https://github.com/your-org/saas-multi-domain-tenant.git
cd saas-multi-domain-tenant
```

### 2. hostsファイルを設定

このプロジェクトは `.local.test` ドメインを使用します（`localhost` ではサブドメイン間のCookie共有ができないため）。

#### macOS / Linux

```bash
sudo nano /etc/hosts
```

以下を追加：

```
127.0.0.1 www.local.test
127.0.0.1 app.local.test
127.0.0.1 admin.local.test
127.0.0.1 ops.local.test
```

保存して閉じる（`Ctrl+O` → `Enter` → `Ctrl+X`）。

#### Windows

管理者権限でメモ帳を開く：

```
C:\Windows\System32\drivers\etc\hosts
```

上記と同じ内容を追加して保存。

### 3. 依存関係をインストール

```bash
pnpm install
```

Turboリポジトリ構成のため、全パッケージが一括インストールされます。

### 4. Supabaseプロジェクトをセットアップ

#### 4-1. Supabaseでプロジェクトを作成

1. https://app.supabase.com にログイン
2. **New Project** をクリック
3. プロジェクト名・リージョン・パスワードを設定
4. **Create new project** をクリック

#### 4-2. スキーマを適用

プロジェクトが作成されたら、SQL Editorでスキーマを適用します。

1. Supabaseダッシュボードで **SQL Editor** を開く
2. **New query** をクリック
3. `infra/supabase/migrations/20251030121106_initial_schema.sql` の内容をコピー＆ペースト
4. **Run** をクリック

以下が作成されます：
- `organizations` テーブル
- `profiles` テーブル
- `activity_logs` テーブル
- `user_org_context` テーブル
- RLSポリシー13個

#### 4-3. シードデータを投入（開発用）

1. SQL Editorで **New query** を開く
2. `infra/supabase/seed.sql` の内容をコピー＆ペースト
3. **Run** をクリック

以下が作成されます：
- サンプル組織2件（Test Organization、Secondary Organization）

#### 4-4. 環境変数を取得

Supabaseダッシュボードで **Settings → API** を開き、以下をコピー：

- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- **anon public** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **service_role** → `SUPABASE_SERVICE_ROLE_KEY` (⚠️ 絶対に公開しない)

### 5. 環境変数を設定

```bash
cp .env.example .env.local
```

`.env.local` を編集して、Supabaseの値を設定：

```bash
# Supabase（必須）
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Cookie Domain（必須）
NEXT_PUBLIC_COOKIE_DOMAIN=.local.test

# Multi-Domain URLs（必須）
NEXT_PUBLIC_WWW_URL=http://www.local.test:3001
NEXT_PUBLIC_APP_URL=http://app.local.test:3002
NEXT_PUBLIC_ADMIN_URL=http://admin.local.test:3003
NEXT_PUBLIC_OPS_URL=http://ops.local.test:3004

# E2E Test Password（E2Eテスト実行時のみ必須）
E2E_TEST_PASSWORD=YourSecurePassword123!

# その他（オプション）
# SENTRY_DSN=
# OPENAI_API_KEY=
```

### 6. E2Eテストユーザーを作成

```bash
pnpm setup:e2e
```

以下のテストユーザーが作成されます：
- `member1@example.com` (member ロール)
- `admin1@example.com` (admin ロール)
- `owner1@example.com` (owner ロール)
- `ops1@example.com` (ops ロール)

パスワードは全て `.env.local` の `E2E_TEST_PASSWORD` で設定した値です。

### 7. 開発サーバーを起動

```bash
pnpm dev
```

以下の4つのアプリが起動します：

- **WWW**: http://www.local.test:3001
- **APP**: http://app.local.test:3002
- **ADMIN**: http://admin.local.test:3003
- **OPS**: http://ops.local.test:3004

### 8. 動作確認

#### 8-1. OPSドメインにアクセス

1. http://ops.local.test:3004/login を開く
2. `ops1@example.com` でログイン（パスワード: `E2E_TEST_PASSWORD`）
3. OPS Consoleが表示されればOK

#### 8-2. 組織切り替え

1. http://app.local.test:3002 を開く
2. `owner1@example.com` でログイン
3. 組織が表示されればOK

---

## 次のステップ

### E2Eテストを実行

```bash
# ヘッドレスモードで実行
pnpm test:e2e

# UIモードで実行（デバッグに便利）
pnpm test:e2e:ui
```

169個のE2Eテストが実行されます（約5分）。

### アーキテクチャを理解

- [Architecture Overview](./architecture-overview.md) - 設計判断の背景
- [Multi-Domain Pattern](../patterns/multi-domain.md) - ドメイン構成の詳細
- [Authentication & Authorization](../patterns/authentication-authorization.md) - 認証・認可の仕組み

### 開発開始

#### 新機能追加の流れ

1. **ブランチを作成**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **実装**
   - `apps/app` - メインアプリ（member/admin/owner）
   - `apps/admin` - 管理画面（admin/owner のみ）
   - `apps/ops` - 運用コンソール（ops のみ）

3. **E2Eテストを追加**
   - `e2e/tests/p1-baseline/` - 基本機能
   - `e2e/tests/p2-members-audit/` - メンバー管理・監査
   - `e2e/tests/p3-ops-orgs/` - OPS・組織管理
   - `e2e/tests/p4-boundary/` - 境界条件

4. **テスト実行**
   ```bash
   pnpm test:e2e
   ```

5. **developにマージ**
   ```bash
   git add .
   git commit -m "Add feature: your-feature-name"
   git push origin feature/your-feature-name
   # GitHub でPR作成 → develop にマージ
   ```

---

## トラブルシューティング

### ドメインにアクセスできない

**原因**: `/etc/hosts` の設定が反映されていない

**解決策**:
```bash
# macOS/Linux
ping www.local.test

# 期待される結果: 127.0.0.1
```

反映されない場合はDNSキャッシュをクリア：
```bash
# macOS
sudo dscacheutil -flushcache
sudo killall -HUP mDNSResponder

# Linux
sudo systemd-resolve --flush-caches
```

### ビルドエラー: "Cannot find module"

**原因**: 依存関係のインストール漏れ

**解決策**:
```bash
pnpm install
```

### Supabase接続エラー

**原因**: 環境変数が正しく設定されていない

**解決策**:
1. `.env.local` が存在することを確認
2. `NEXT_PUBLIC_SUPABASE_URL` と `NEXT_PUBLIC_SUPABASE_ANON_KEY` が正しいか確認
3. 開発サーバーを再起動

### E2Eテストが失敗する

**原因**: テストユーザーが作成されていない

**解決策**:
```bash
pnpm setup:e2e
```

### Cookie共有ができない

**原因**: `NEXT_PUBLIC_COOKIE_DOMAIN` が `.local.test` になっていない

**解決策**:
`.env.local` を確認：
```bash
NEXT_PUBLIC_COOKIE_DOMAIN=.local.test
```

---

## よくある質問

### Q1. なぜ `localhost` ではなく `.local.test` を使うのか？

**A**: `localhost` ではサブドメイン間のCookie共有ができないため。`.local.test` を使うことで、`www.local.test`, `app.local.test`, `admin.local.test`, `ops.local.test` 間でCookieを共有できます。

### Q2. 4つのアプリを統合して1つにできないか？

**A**: できません。セキュリティ境界・監査・ロールバック分離のため、4つのアプリは独立してデプロイされる設計です（[Architecture Overview](./architecture-overview.md) 参照）。

### Q3. E2Eテストは必須か？

**A**: はい。このプロジェクトではE2Eテストで権限境界・ドメイン分離・RLSを検証します。テストなしでのマージは推奨されません。

### Q4. 本番デプロイはどうするのか？

**A**: [Vercel Setup Guide](../deployment/vercel-setup.md) と [Domain Configuration Guide](../deployment/domain-configuration.md) を参照してください。

---

## チェックリスト

セットアップ完了後、以下を確認：

- [ ] `/etc/hosts` に `.local.test` ドメインが登録されている
- [ ] `pnpm install` が成功している
- [ ] Supabaseプロジェクトが作成されている
- [ ] スキーマ（migrations）が適用されている
- [ ] シードデータが投入されている
- [ ] `.env.local` が作成され、必須環境変数が設定されている
- [ ] E2Eテストユーザーが作成されている
- [ ] `pnpm dev` で4つのアプリが起動する
- [ ] http://ops.local.test:3004/login でログインできる
- [ ] `pnpm test:e2e` で全テストが合格する

---

## サポート

質問・問題がある場合：

1. [Troubleshooting Guide](../troubleshooting/) を確認
2. GitHubでIssueを作成
3. チームSlackで質問

---

## 参考資料

- [README.md](../../README.md) - プロジェクト概要
- [Architecture Overview](./architecture-overview.md) - 設計判断の背景
- [Supabase Setup](../../infra/supabase/SETUP.md) - Supabase詳細セットアップ
- [E2E Testing Pattern](../patterns/e2e-testing.md) - E2Eテストの書き方
