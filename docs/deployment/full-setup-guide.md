# 完全セットアップガイド（CLI版）

このガイドでは、テンプレートから新規プロジェクトを作成し、Vercelにデプロイして本番/Preview環境で動作確認するまでの完全な手順を説明します。

---

## 前提：CLI準備

```bash
# Supabase CLI
brew install supabase/tap/supabase
supabase login

# GitHub CLI
brew install gh
gh auth login

# Vercel CLI
npm i -g vercel
vercel login
```

---

## 1. Supabase設定

1. [Supabase Dashboard](https://supabase.com) でプロジェクト作成
2. 認証情報を取得:
   - Project URL
   - anon public key
   - service_role key
   - Database URL（Settings → Database → Connection string）

3. スキーマ適用:

```bash
psql "postgresql://postgres:PASSWORD@db.xxxxx.supabase.co:5432/postgres" \
  -f infra/supabase/migrations/00000000000000_consolidated_schema.sql
```

---

## 2. ローカル環境

```bash
# 環境変数ファイル作成
cp .env.example .env.local
cp .env.example .env.test

# .env.local と .env.test を編集
# - NEXT_PUBLIC_SUPABASE_URL
# - NEXT_PUBLIC_SUPABASE_ANON_KEY
# - SUPABASE_SERVICE_ROLE_KEY
# - E2E_TEST_PASSWORD
# - NEXT_PUBLIC_COOKIE_DOMAIN=.local.test
# - NEXT_PUBLIC_WWW_URL=http://www.local.test:3001
# - NEXT_PUBLIC_APP_URL=http://app.local.test:3002
# - NEXT_PUBLIC_ADMIN_URL=http://admin.local.test:3003
# - NEXT_PUBLIC_OPS_URL=http://ops.local.test:3004

# 依存関係インストール & ビルド
pnpm install
pnpm build

# テストユーザー作成
pnpm setup:e2e

# 初期データ投入
pnpm seed:all
```

---

## 3. GitHub設定

```bash
# リポジトリ作成
gh repo create your-project-name --private

# リモート設定 & プッシュ
git remote add origin https://github.com/USER/your-project-name.git
git branch -M main
git push -u origin main

# developブランチ作成
git checkout -b develop
git push -u origin develop
```

---

## 4. Vercelプロジェクト作成（Dashboard）

[Vercel Dashboard](https://vercel.com) で4つのプロジェクトを作成:

| プロジェクト名 | Root Directory |
|---------------|----------------|
| your-project-www | apps/www |
| your-project-app | apps/app |
| your-project-admin | apps/admin |
| your-project-ops | apps/ops |

各プロジェクトで「Import Git Repository」から同じリポジトリを選択し、Root Directoryを設定。

---

## 5. Vercel CLIリンク

```bash
cd apps/www && vercel link --yes -p your-project-www
cd ../app && vercel link --yes -p your-project-app
cd ../admin && vercel link --yes -p your-project-admin
cd ../ops && vercel link --yes -p your-project-ops
cd ../..
```

---

## 6. 環境変数設定（Production）

各アプリで繰り返し実行:

```bash
cd apps/www  # または app, admin, ops

# Supabase
echo "https://xxxxx.supabase.co" | vercel env add NEXT_PUBLIC_SUPABASE_URL production
echo "eyJ..." | vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
echo "eyJ..." | vercel env add SUPABASE_SERVICE_ROLE_KEY production

# URLs（本番ドメイン）
echo "https://www.example.com" | vercel env add NEXT_PUBLIC_WWW_URL production
echo "https://app.example.com" | vercel env add NEXT_PUBLIC_APP_URL production
echo "https://admin.example.com" | vercel env add NEXT_PUBLIC_ADMIN_URL production
echo "https://ops.example.com" | vercel env add NEXT_PUBLIC_OPS_URL production

# Cookie Domain
echo ".example.com" | vercel env add NEXT_PUBLIC_COOKIE_DOMAIN production
```

---

## 7. 環境変数設定（Preview）

各アプリで繰り返し実行:

```bash
cd apps/www  # または app, admin, ops

# Supabase（同じ値）
echo "https://xxxxx.supabase.co" | vercel env add NEXT_PUBLIC_SUPABASE_URL preview
echo "eyJ..." | vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY preview
echo "eyJ..." | vercel env add SUPABASE_SERVICE_ROLE_KEY preview

# URLs（Previewドメイン）
echo "https://dev-www.example.com" | vercel env add NEXT_PUBLIC_WWW_URL preview
echo "https://dev-app.example.com" | vercel env add NEXT_PUBLIC_APP_URL preview
echo "https://dev-admin.example.com" | vercel env add NEXT_PUBLIC_ADMIN_URL preview
echo "https://dev-ops.example.com" | vercel env add NEXT_PUBLIC_OPS_URL preview

# Cookie Domain（同じ値）
echo ".example.com" | vercel env add NEXT_PUBLIC_COOKIE_DOMAIN preview
```

---

## 8. DNS設定

お名前.com等のDNS管理画面でCNAMEレコードを追加:

| ホスト名 | 種別 | 値 |
|---------|------|-----|
| www | CNAME | cname.vercel-dns.com |
| app | CNAME | cname.vercel-dns.com |
| admin | CNAME | cname.vercel-dns.com |
| ops | CNAME | cname.vercel-dns.com |
| dev-www | CNAME | cname.vercel-dns.com |
| dev-app | CNAME | cname.vercel-dns.com |
| dev-admin | CNAME | cname.vercel-dns.com |
| dev-ops | CNAME | cname.vercel-dns.com |

---

## 9. カスタムドメイン追加

### Production用（CLI）

```bash
cd apps/www && vercel domains add www.example.com
cd ../app && vercel domains add app.example.com
cd ../admin && vercel domains add admin.example.com
cd ../ops && vercel domains add ops.example.com
```

### Preview用（Dashboard）

各プロジェクトで:
1. Settings → Domains
2. `dev-www.example.com` 等を追加
3. Git Branch を `develop` に設定

---

## 10. 環境とブランチの対応

| 環境 | ブランチ | ドメイン | 用途 |
|------|---------|---------|------|
| Production | main | www/app/admin/ops.example.com | 本番 |
| Preview | develop | dev-www/dev-app/dev-admin/dev-ops.example.com | ステージング |
| Preview | feature/* | ランダムURL (*.vercel.app) | 機能開発確認 |

---

## 11. デプロイフロー

```
[開発] develop で作業
    ↓
[テスト] ローカルE2E実行
    ↓
[Push] git push origin develop
    ↓
[CI] GitHub Actions 自動実行
    ↓
[Preview] dev-*.example.com に自動デプロイ
    ↓
[確認] Preview環境で動作確認
    ↓
[Merge] develop → main にマージ/プッシュ
    ↓
[CI] GitHub Actions 自動実行
    ↓
[Production] *.example.com に自動デプロイ
```

---

## 12. 動作確認

```bash
# redeployトリガー（環境変数変更後など）
git commit --allow-empty -m "trigger redeploy" && git push

# Production確認
curl -sI https://www.example.com | head -5
curl -sI https://app.example.com | head -5

# Preview確認
curl -sI https://dev-www.example.com | head -5
curl -sI https://dev-app.example.com | head -5
```

---

## 補足：環境変数の確認

```bash
cd apps/www  # または app, admin, ops
vercel env ls production  # Production環境変数一覧
vercel env ls preview     # Preview環境変数一覧
```

---

## 参考資料

- [Vercel セットアップ（Dashboard版）](./vercel-setup.md)
- [ドメイン設定ガイド](./domain-configuration.md)
- [クイックスタート（ローカル開発）](../onboarding/quickstart.md)
