# 機能名: テナンシー / マルチテナント仕様 (Tenancy)

## 概要
本システムはマルチテナントSaaSであり、すべてのデータアクセスは `organization_id` を境界とする。この仕様は、テナント分離の基本原則、RLS（Row Level Security）、組織とロールの関係、ドメイン責務、監査ログの要件を定義する。

## 対象ドメイン
全ドメイン（`www`, `app`, `admin`, `ops`）に適用される基本仕様

## 前提・前提条件
- DBはPostgres/Supabaseを想定
- Supabase Authが認証のソースオブトゥルース
- すべてのテーブルは `organization_id` でテナント境界を持っている
- 現在のアクティブな組織IDはセッションとCookieで保持される
- 参考: [CLAUDE_RUNTIME_MIN.md](../../CLAUDE_RUNTIME_MIN.md)

## 正常フロー

### 基本前提
- **1ユーザーは複数の組織(org)に所属できる**
- **ユーザーはUI上で「現在アクティブな組織(org_id)」を切り替えることができる**
  - 詳細は [組織切り替え仕様](./organization-switching.md) を参照
- **現在のorg_idはサーバー側セッションとCookieで保持**
  - middlewareはこのorg_idを前提にルーティング・アクセス制御を行う
  - middlewareの挙動を勝手に簡略化・変更しない

### RLS（Row Level Security）
- **すべての行は `organization_id` でスコープされる**
- **RLSは全てのSELECT/INSERT/UPDATE/DELETEで `organization_id` チェックを行う**
- **RLSを無効化・バイパスしない（テストでも同様）**
- **実装位置**: `infra/supabase/migrations/` の初期スキーマおよび後続マイグレーションにて実装済み
  （詳細は `infra/supabase/RLS.md` を参照）

### 組織とロール
**階層構造**: `member ⊂ admin ⊂ owner`。`ops` は事業者側で別枠。
- **member**: appで日々の業務。組織/他ユーザー設定は触らない。アクセス: `app.*`
- **admin**: memberを包含。`admin.*` で同一組織内ユーザーCRUD。owner操作は不可
- **owner**: adminを包含。支払い変更/凍結・廃止/owner譲渡等が可能。アクセス: `admin.*` と `app.*`。各orgに必ず1人
- **ops**: 事業者側運用（今はダミー）

### ドメイン責務（混ぜない）
- **`www`**: LP/説明/ログイン導線
- **`app`**: 日常業務UI（orgコンテキストに依存）
- **`admin`**: 組織管理・契約・支払い・凍結・権限管理（memberは403）
- **`ops`**: 事業者側社内用（今はダミー）
詳細: [マルチドメインパターン](../patterns/multi-domain.md)

### 監査 (activity_logs)
必ず記録する操作：
- 組織切替
- adminによるユーザー管理（作成/ロール変更/無効化/削除）
- ownerによる組織レベル操作（支払い変更 / 凍結・廃止 / owner譲渡 / admin権限の付け替え）
※ 監査ログ仕様は削らない・弱めない

## 権限制御の原則
1. **すべてのDBクエリで `organization_id` を明示指定**
2. **RLSとアプリ側チェックの二重化（RLSは最終防御線）**
3. **フロントだけで判定を完結させない（Server Actionで再チェック）**

## Server Actionの注意
- 戻り値は `{ success, nextUrl }` で返す
- `redirect()` は禁止（クライアント側で `router.push()` / `location.assign()`）

## 禁止事項
- RLSの無効化/バイパス
- 「全件取得してクライアントでフィルタ」
- `owner` 不在の組織の作成/テスト
- owner専用操作をappドメインに置く
- adminにowner相当操作を混ぜる
- middlewareの簡略化/統合
- 監査ログの省略/弱体化

## 関連参照
- [CLAUDE_RUNTIME_MIN.md](../../CLAUDE_RUNTIME_MIN.md)
- [権限モデル仕様書](./roles-and-access.md)
- [組織切り替え仕様](./organization-switching.md)
- [マルチドメインパターン](../patterns/multi-domain.md)
- [Server Actionsパターン](../patterns/server-actions.md)
- [infra/supabase/RLS.md](../../infra/supabase/RLS.md)
