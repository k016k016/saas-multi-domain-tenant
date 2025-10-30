# Supabase / Postgres インフラ概要

このディレクトリは、マルチテナントSaaSのDB層（Postgres / Supabase）に関する構成・手順・規約をまとめます。

## 目的
- スキーマとRLSの"単一の真実"をここに集約
- セットアップ/マイグレーション/テスト動線の明確化
- アプリ層に跨る議論は `docs/spec/tenancy.md` を参照

## ディレクトリ構成

```
infra/supabase/
├─ README.md            # ← このファイル
├─ SETUP.md             # プロジェクト作成・接続・ローカル起動
├─ RLS.md               # RLSポリシーの仕様・方針・テスト観点
├─ migrations/          # すべてのDDL/RLSをここに積む（supabase CLI）
│  ├─ 20251030121106_initial_schema.sql
│  └─ …後続マイグレーション
├─ seed.sql             # 開発用シード（org/user/roleの最小セット）
├─ .gitignore
└─ config.toml          # Supabase CLI設定
```

## クイックスタート（ローカル）

1. **Supabase CLI を導入**
   ```bash
   npm install -g supabase
   ```

2. **環境変数の設定**
   `.env.local` に以下を設定：
   ```bash
   SUPABASE_URL=
   SUPABASE_ANON_KEY=
   SUPABASE_SERVICE_ROLE_KEY=
   ```

3. **ローカルDBを起動・初期化**（*破壊的*）
   ```bash
   supabase start
   supabase db reset
   supabase db push
   ```

4. **必要に応じてシード投入**
   ```bash
   supabase db query < seed.sql
   ```

## 本番反映の基本
- DDL/RLSは**必ず** `migrations/` に積み、**手作業でDBに書かない**
- 反映は `supabase db push` を使う（Dockerが必要）
- Dockerがない環境では、Supabase StudioのSQLエディタで手動実行
- ロールバック手順は `SETUP.md` を参照

## 重要ポリシー
- **RLSは常時有効**（テストでも無効化しない）
- **`organization_id` によるデータ分離が大前提**
- **`owner` は各orgに常に1名、削除不可（譲渡のみ）**
- **監査（`activity_logs`）は不可欠。重要操作は全て記録**

## 参照
- [テナンシー仕様](../../docs/spec/tenancy.md)
- [RLSポリシー詳細](./RLS.md)
- [RLSテストパターン](../../docs/patterns/rls-testing.md)
- [セットアップ手順](./SETUP.md)
