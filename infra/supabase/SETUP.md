# Supabase セットアップ手順

このドキュメントは、Supabaseプロジェクトの作成からデータベーススキーマの適用、環境変数の設定までの手順をまとめたものです。

## 前提条件

- Supabaseアカウントを作成済みであること（https://app.supabase.com）
- ローカル環境に `pnpm` がインストール済みであること
- `/etc/hosts` に `.local.test` ドメインの設定が完了していること

## ステップ1: Supabaseプロジェクト作成

1. https://app.supabase.com にアクセスしてログイン
2. **"New Project"** をクリック
3. プロジェクト設定:
   - **Name**: `saas-multi-tenant` (任意)
   - **Database Password**: 強力なパスワードを生成・保存
   - **Region**: `Northeast Asia (Tokyo)` を推奨
   - **Pricing Plan**: `Free` (開発用) または `Pro`
4. **"Create new project"** をクリックして数分待つ

## ステップ2: データベーススキーマの適用

### 2-1. SQL Editorを開く

1. 左サイドバーから **"SQL Editor"** を選択
2. **"New query"** をクリック

### 2-2. schema.sqlを実行

1. `infra/supabase/schema.sql` の内容をコピー
2. SQL Editorにペースト
3. **"Run"** ボタンをクリック

実行後、以下のテーブルが作成されます：
- `organizations` - 組織（テナント）情報
- `profiles` - ユーザーと組織の関連、ロール管理
- `activity_logs` - 監査ログ

### 2-3. 初期データの確認

1. 左サイドバーから **"Table Editor"** を選択
2. `organizations` テーブルを開く
3. サンプル組織2件が作成されていることを確認:
   - `org_dummy_12345`: サンプル組織A (business)
   - `org_dummy_67890`: サンプル組織B (free)

## ステップ3: 環境変数の取得

### 3-1. Project URL の取得

1. 左サイドバーから **"Project Settings"** → **"API"** を選択
2. **"Project URL"** をコピー
   - 形式: `https://xxxxx.supabase.co`

### 3-2. API Keys の取得

同じ画面で以下のキーをコピー：

1. **"anon / public" key** (SUPABASE_ANON_KEY)
   - クライアント側で使用
   - 公開しても安全（RLSで保護）

2. **"service_role" key** (SUPABASE_SERVICE_ROLE_KEY)
   - サーバー側のみで使用
   - **絶対に公開しない**
   - RLSをバイパスできる強力な権限

## ステップ4: 環境変数の設定

### 4-1. .env.local を更新

プロジェクトルートの `.env.local` を開き、以下を設定：

```bash
# Supabase プロジェクトの URL と API キー
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**注意**:
- `.env.local` は `.gitignore` に含まれており、Git管理対象外
- `SUPABASE_SERVICE_ROLE_KEY` は特に慎重に扱うこと

### 4-2. Turbo のキャッシュをクリア（任意）

環境変数を更新した後は、Turbo のキャッシュをクリアすることを推奨：

```bash
pnpm turbo clean
```

## ステップ5: 認証設定（Auth）

### 5-1. Redirect URLs の設定

1. **"Project Settings"** → **"Authentication"** → **"URL Configuration"** を開く
2. **"Redirect URLs"** に以下を追加:

```
http://www.local.test:3001/auth/callback
http://app.local.test:3002/auth/callback
http://admin.local.test:3003/auth/callback
http://ops.local.test:3004/auth/callback
```

### 5-2. Site URL の設定

**"Site URL"** を以下に設定:

```
http://www.local.test:3001
```

### 5-3. Additional Redirect URLs の設定（本番用）

本番環境用の Redirect URLs も追加しておく（デプロイ前に必須）:

```
https://www.yourdomain.com/auth/callback
https://app.yourdomain.com/auth/callback
https://admin.yourdomain.com/auth/callback
https://ops.yourdomain.com/auth/callback
```

## ステップ6: 動作確認

### 6-1. 開発サーバーを起動

```bash
# ターミナル1
cd apps/www && pnpm run dev    # ポート 3001

# ターミナル2
cd apps/app && pnpm run dev    # ポート 3002

# ターミナル3
cd apps/admin && pnpm run dev  # ポート 3003

# ターミナル4
cd apps/ops && pnpm run dev    # ポート 3004
```

### 6-2. 接続確認

各アプリが正常に起動し、Supabaseクライアントがエラーなく初期化されることを確認。

## トラブルシューティング

### エラー: "Invalid API key"

- `.env.local` の `SUPABASE_ANON_KEY` が正しいか確認
- キーの前後にスペースや改行がないか確認
- Turbo のキャッシュをクリア: `pnpm turbo clean`

### エラー: "Failed to fetch"

- `.env.local` の `SUPABASE_URL` が正しいか確認
- Supabaseプロジェクトが稼働中か確認（Dashboard で確認）

### schema.sql 実行時のエラー

- 既存のテーブルがある場合、`DROP TABLE IF EXISTS ...` を追加
- SQL Editor でエラーメッセージを確認し、該当行を修正

## RLS (Row Level Security) について

**重要**: 現在、RLSポリシーは未実装です（`-- TODO: RLS policies`）。

- 各テーブルで `ENABLE ROW LEVEL SECURITY` は既に設定済み
- ポリシーが未実装のため、現状では `service_role` キーでのみデータアクセス可能
- 将来的に実装予定:
  - `organizations`: ユーザーが所属する組織のみ読み取り可能
  - `profiles`: 同じ組織のプロフィールのみ読み取り可能
  - `activity_logs`: 同じ組織のログのみ読み取り可能、更新・削除は禁止

**注意**: RLSを無効化・バイパスする実装は許可されていません。

## 次のステップ

Supabaseの準備が完了したら、次のステップに進みます：

1. **ステップ4: admin/members を実装** - 組織内ユーザー管理機能
2. **ステップ5: E2Eテストとmiddlewareテスト** - 権限チェックの動作確認

## 参考リンク

- [Supabase 公式ドキュメント](https://supabase.com/docs)
- [Supabase Auth (Next.js)](https://supabase.com/docs/guides/auth/auth-helpers/nextjs)
- [Row Level Security (RLS)](https://supabase.com/docs/guides/auth/row-level-security)
