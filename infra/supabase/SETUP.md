# Supabase SETUP

1. Supabaseで新しいプロジェクトを作成する（プロジェクト名は自由で良い）
2. SQLエディタで `infra/supabase/schema.sql` の内容を適用する
   - organizations / profiles / activity_logs が作成されること
   - コメントは削除しない（RLS前提・owner一人制・activity_logs必須など）
3. プロジェクト設定から以下を取得し、ルートの `.env.local` に設定する:
   - SUPABASE_URL=
   - SUPABASE_ANON_KEY=
   - SUPABASE_SERVICE_ROLE_KEY=
4. ローカル開発時は次のドメイン/ポートで各アプリを起動する:
   - www.local.test:3001
   - app.local.test:3002
   - admin.local.test:3003
   - ops.local.test:3004
5. Cookie は `Domain=.local.test` 前提で発行する予定。
   - ポートが違っても `.local.test` のCookieは共有される。
   - SameSite=None; Secure は本番用の挙動（ローカルHTTPではSecure Cookieは送られない点に注意）。

## マイグレーション管理

Supabase CLIを使用してデータベーススキーマのバージョン管理を行います。

### 初期セットアップ

プロジェクトはすでにSupabase CLIでリンク済みです：

```bash
# リンク状態を確認
supabase link --project-ref qtjcoffmwmqgfdqimlis
```

### マイグレーションファイルの場所

- `infra/supabase/supabase/migrations/` にマイグレーションファイルが格納されています
- 現在の初期マイグレーション: `20251030121106_initial_schema.sql`

### 新しいマイグレーションの作成

スキーマに変更を加える場合は、新しいマイグレーションファイルを作成します：

```bash
cd infra/supabase
supabase migration new <migration_name>
```

例：
```bash
supabase migration new add_user_preferences_table
```

これにより `supabase/migrations/YYYYMMDDHHMMSS_<migration_name>.sql` が作成されます。

### マイグレーションの適用

**注意**: `supabase db push` はDockerが必要です。現在はSupabase Studio（Webコンソール）のSQLエディタで手動実行してください。

```bash
# Docker が利用可能な場合
cd infra/supabase
supabase db push
```

Docker がない環境では、Supabase StudioのSQLエディタで以下の手順を実行：

1. https://app.supabase.com でプロジェクトを開く
2. SQL Editorに移動
3. マイグレーションファイルの内容をコピー＆ペースト
4. 実行

### ベストプラクティス

1. **マイグレーションは順序を守る**: ファイル名のタイムスタンプ順に実行する
2. **直接編集しない**: 既存のマイグレーションファイルは編集せず、新しいファイルを作成する
3. **スキーマと同期**: `schema.sql` は参照用として保持し、実際の変更は `migrations/` で管理する
4. **テスト**: マイグレーションを本番に適用する前に、開発環境でテストする
5. **Gitで管理**: マイグレーションファイルは必ずGitにコミットする
