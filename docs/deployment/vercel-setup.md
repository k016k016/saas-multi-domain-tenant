# Vercel セットアップガイド

このプロジェクトは4つの独立したNext.jsアプリケーション（www/app/admin/ops）を別々のVercelプロジェクトとしてデプロイします。

---

## 前提条件

- Vercelアカウント（Team推奨、複数プロジェクトを同一リポジトリから作成するため）
- GitHubリポジトリへのプッシュ権限
- Supabaseプロジェクトのセットアップ完了（[SETUP.md](../../infra/supabase/SETUP.md) 参照）

---

## デプロイ方針

### 重要な設計判断

このプロジェクトは**4つのアプリを1つのVercelプロジェクトに統合しない**設計です。

**理由**:
1. **セキュリティ境界**: 各ドメインは異なる権限レベル（member/admin/owner/ops）を持つため、独立したデプロイで責任分離
2. **監査**: 変更履歴・ロールバックを個別に管理
3. **ロールバック分離**: admin画面の問題がapp画面に影響しない
4. **権限境界の明確化**: middlewareやルーティングの混在を避ける

**禁止パターン**:
- 全部1つのNext.jsプロジェクトにまとめてhostヘッダで振り分ける
- apps/www/app/admin/... のようなネスト構造

---

## セットアップ手順

### 1. Vercelプロジェクト作成（4つ）

各アプリケーションごとにVercelプロジェクトを作成します。

#### 1-1. WWWプロジェクト

1. Vercelダッシュボードで **Add New Project**
2. GitHubリポジトリを選択
3. **Project Settings**:
   - **Project Name**: `saas-www` （任意の名前）
   - **Framework Preset**: Next.js
   - **Root Directory**: `apps/www`
   - **Build Command**: `pnpm turbo run build --filter=www`
   - **Output Directory**: `.next`
   - **Install Command**: `pnpm install`

#### 1-2. APPプロジェクト

1. Vercelダッシュボードで **Add New Project**
2. 同じGitHubリポジトリを選択
3. **Project Settings**:
   - **Project Name**: `saas-app`
   - **Framework Preset**: Next.js
   - **Root Directory**: `apps/app`
   - **Build Command**: `pnpm turbo run build --filter=app`
   - **Output Directory**: `.next`
   - **Install Command**: `pnpm install`

#### 1-3. ADMINプロジェクト

1. Vercelダッシュボードで **Add New Project**
2. 同じGitHubリポジトリを選択
3. **Project Settings**:
   - **Project Name**: `saas-admin`
   - **Framework Preset**: Next.js
   - **Root Directory**: `apps/admin`
   - **Build Command**: `pnpm turbo run build --filter=admin`
   - **Output Directory**: `.next`
   - **Install Command**: `pnpm install`

#### 1-4. OPSプロジェクト

1. Vercelダッシュボードで **Add New Project**
2. 同じGitHubリポジトリを選択
3. **Project Settings**:
   - **Project Name**: `saas-ops`
   - **Framework Preset**: Next.js
   - **Root Directory**: `apps/ops`
   - **Build Command**: `pnpm turbo run build --filter=ops`
   - **Output Directory**: `.next`
   - **Install Command**: `pnpm install`

---

### 2. 環境変数の設定

各プロジェクトに以下の環境変数を設定します（**Settings → Environment Variables**）。

#### 共通環境変数（全プロジェクト）

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Cookie Domain（本番ドメインに合わせる）
NEXT_PUBLIC_COOKIE_DOMAIN=.yourdomain.com
```

#### ドメイン別環境変数（各プロジェクト個別）

**WWWプロジェクト**:
```bash
NEXT_PUBLIC_WWW_URL=https://www.yourdomain.com
NEXT_PUBLIC_APP_URL=https://app.yourdomain.com
NEXT_PUBLIC_ADMIN_URL=https://admin.yourdomain.com
NEXT_PUBLIC_OPS_URL=https://ops.yourdomain.com
```

**APPプロジェクト**:
```bash
NEXT_PUBLIC_WWW_URL=https://www.yourdomain.com
NEXT_PUBLIC_APP_URL=https://app.yourdomain.com
NEXT_PUBLIC_ADMIN_URL=https://admin.yourdomain.com
NEXT_PUBLIC_OPS_URL=https://ops.yourdomain.com
```

**ADMINプロジェクト**:
```bash
NEXT_PUBLIC_WWW_URL=https://www.yourdomain.com
NEXT_PUBLIC_APP_URL=https://app.yourdomain.com
NEXT_PUBLIC_ADMIN_URL=https://admin.yourdomain.com
NEXT_PUBLIC_OPS_URL=https://ops.yourdomain.com
```

**OPSプロジェクト**:
```bash
NEXT_PUBLIC_WWW_URL=https://www.yourdomain.com
NEXT_PUBLIC_APP_URL=https://app.yourdomain.com
NEXT_PUBLIC_ADMIN_URL=https://admin.yourdomain.com
NEXT_PUBLIC_OPS_URL=https://ops.yourdomain.com
```

#### オプション環境変数

```bash
# Sentry（エラートラッキング）
SENTRY_DSN=your-sentry-dsn

# OpenAI（AI機能用）
OPENAI_API_BASE=https://api.openai.com/v1
OPENAI_API_KEY=your-openai-key
```

**重要**: `SUPABASE_SERVICE_ROLE_KEY` は絶対に公開しないこと。Vercelの環境変数としてのみ設定してください。

---

### 3. ブランチ設定

各プロジェクトのデプロイブランチを設定します。

**Production Branch**: `main`
- 本番環境に対応
- 安定版のみマージ

**Preview Branch**: `develop`
- プレビュー環境に対応
- 日常開発用

**Settings → Git**:
- Production Branch: `main`
- Automatic deployments from Git: 有効
- Deploy Previews: `develop` ブランチのみ

---

### 4. カスタムドメインの設定

各プロジェクトにカスタムドメインを割り当てます（[domain-configuration.md](./domain-configuration.md) も参照）。

**WWWプロジェクト**:
- `www.yourdomain.com`

**APPプロジェクト**:
- `app.yourdomain.com`
- `*.app.yourdomain.com` （将来的な組織サブドメイン対応）

**ADMINプロジェクト**:
- `admin.yourdomain.com`

**OPSプロジェクト**:
- `ops.yourdomain.com`

---

## デプロイフロー

### 日常開発

1. `feature/<name>` ブランチで作業
2. `develop` にマージ → Vercel Preview環境に自動デプロイ
3. Previewで動作確認

### 本番リリース

1. `develop` が安定したら `main` にマージ
2. Vercel Production環境に自動デプロイ
3. 4つのプロジェクトすべてがデプロイされることを確認

**注意**: 4つのプロジェクトのバージョンを揃えることを推奨します。一部だけ古いバージョンにすると、Cookie共有やドメイン間遷移で不整合が起きる可能性があります。

---

## トラブルシューティング

### ビルドエラー: "turbo: command not found"

**原因**: Turboがインストールされていない

**解決策**: `package.json` のルートに `turbo` が `devDependencies` に含まれていることを確認
```json
{
  "devDependencies": {
    "turbo": "^2.x.x"
  }
}
```

### ビルドエラー: "Cannot find module '@/...'

**原因**: Root Directory設定が間違っている

**解決策**: 各プロジェクトの **Root Directory** が正しいか確認
- WWW: `apps/www`
- APP: `apps/app`
- ADMIN: `apps/admin`
- OPS: `apps/ops`

### 環境変数が反映されない

**原因**: デプロイ後に環境変数を追加した場合、再デプロイが必要

**解決策**:
1. **Settings → Environment Variables** で変数を確認
2. **Deployments → Redeploy** で最新コミットを再デプロイ

### Cookie共有ができない

**原因**: `NEXT_PUBLIC_COOKIE_DOMAIN` の設定ミス

**解決策**:
- `.yourdomain.com` のようにドット（`.`）で始まることを確認
- 全プロジェクトで同じ値になっているか確認

---

## チェックリスト

デプロイ前に以下を確認してください：

- [ ] 4つのVercelプロジェクトが作成されている
- [ ] 各プロジェクトの Root Directory が正しい（`apps/www`, `apps/app`, `apps/admin`, `apps/ops`）
- [ ] 全プロジェクトに共通環境変数が設定されている
- [ ] `NEXT_PUBLIC_COOKIE_DOMAIN` が全プロジェクトで同じ値（`.yourdomain.com`）
- [ ] Production Branch が `main`、Preview Branch が `develop` に設定されている
- [ ] カスタムドメインが各プロジェクトに割り当てられている
- [ ] DNSレコードが正しく設定されている（[domain-configuration.md](./domain-configuration.md) 参照）
- [ ] Supabaseマイグレーションが本番DBに適用されている

---

## 参考資料

- [Vercel Documentation - Monorepo Support](https://vercel.com/docs/concepts/monorepos)
- [Domain Configuration Guide](./domain-configuration.md)
- [Supabase Setup Guide](../../infra/supabase/SETUP.md)
