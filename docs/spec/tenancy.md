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
- 参考: [CLAUDE.md - マルチテナントSaaSの全体ルール](../../CLAUDE.md#マルチテナントsaasの全体ルール)

## 正常フロー

### 基本前提

- **1ユーザーは複数の組織(org)に所属できる**
  - ユーザーは複数の組織に参加でき、それぞれ異なるロールを持つことができる
- **ユーザーはUI上で「現在アクティブな組織(org_id)」を切り替えることができる**
  - 詳細は [組織切り替え仕様](./organization-switching.md) を参照
- **現在のorg_idはサーバー側セッションとCookieで保持する**
  - middlewareはこのorg_idを前提にルーティング・アクセス制御を行う
  - middlewareの挙動を勝手に簡略化・変更してはならない

### RLS（Row Level Security）

- **すべての行は `org_id`（または同等のテナント識別子）でスコープされる**
  - テーブル設計時は必ず `organization_id` カラムを含める
  - RLSポリシーは全てのSELECT/INSERT/UPDATE/DELETEで `organization_id` チェックを行う
- **RLSを一時的に無効化する・バイパスする・「テストだから全件見せる」は禁止**
  - テストでもRLSは有効のまま
  - テスト用のシードデータは適切な `organization_id` を設定する
- **`ops` は将来的に複数orgを横断して参照できる特殊ロールだが、この雛形ではops機能自体は実装しない**
  - 現時点では `ops` はダミーのみ

### 組織とロール

**階層構造**: `member ⊂ admin ⊂ owner` の継承関係。`ops` は別枠。

- **member**: 
  - appで日々の業務を行う
  - 別ユーザーや組織設定には触れない
  - アクセス可能ドメイン: `app.*` のみ

- **admin**: 
  - member権限を含む
  - adminドメインで同一組織内ユーザーのCRUDができる
  - アクセス可能ドメイン: `admin.*` のみ
  - 詳細: [権限モデル仕様書](./roles-and-access.md)

- **owner**: 
  - admin権限を含む
  - 支払い情報の変更、組織の凍結/廃止、owner譲渡など「組織そのものの決定」ができる
  - アクセス可能ドメイン: `admin.*` と `app.*` の両方
  - **各orgには必ず `owner` が1人存在する。`owner` 不在のorg状態は作らない/テストしない**
  - 詳細: [権限モデル仕様書](./roles-and-access.md)

- **ops**: 
  - 事業者側の運用担当
  - 今回はダミーのみ（実装対象外）

**重要**: admin権限とowner権限は混ぜない。owner専用の操作（支払い・凍結・owner譲渡など）をapp側に置かない。

### ドメイン責務

- **`www`**: 
  - LP / 説明 / ログイン導線
  - 内部データを出さない

- **`app`**: 
  - 日常業務UI
  - member/admin/ownerが使う
  - 組織コンテキスト(org_id)に沿った業務表示が主

- **`admin`**: 
  - 組織の管理・契約・支払い・凍結・権限管理
  - memberは403でアクセス拒否

- **`ops`**: 
  - 事業者側の社内用
  - 今回はダミーページのみ

詳細: [マルチドメインパターン](../patterns/multi-domain.md)

### 監査 (activity_logs)

以下の操作は必ず `activity_logs` に記録される前提とする：

- **組織切替**: ユーザーがどのorgに切り替えたか
- **adminによるユーザー管理**: 作成 / ロール変更 / 無効化
- **ownerによる組織レベルの操作**: 
  - 支払い変更
  - 組織の凍結・廃止
  - owner譲渡
  - admin権限の付け替え

**これらの監査ログ仕様は削らない・弱めないこと。**

## 権限制御

### データアクセスの基本原則

1. **すべてのDBクエリで `organization_id` を明示的に指定**
   ```typescript
   // ✅ 良い例
   const items = await db
     .select()
     .from(items)
     .eq('organization_id', currentOrgId)
   
   // ❌ 悪い例
   const items = await db.select().from(items) // org境界なし
   ```

2. **RLSとアプリケーション側のチェックを両方実装**
   - RLSが最終防御線
   - アプリケーション側でも権限チェックを行う（RLS任せにしない）

3. **フロント側のrole判定だけでアクセス制御を完結させない**
   - 必ずサーバ側（Server Action/API Route）で再チェック

### 組織境界の確認

Server Action実装時は必ず以下をチェック：

```typescript
// 1. 現在のアクティブな組織IDを取得
const { currentOrgId } = await getCurrentOrgContext()

// 2. リクエストされたorgIdと一致するか確認
if (requestedOrgId !== currentOrgId) {
  return { success: false, error: 'Organization mismatch' }
}

// 3. ユーザーがこの組織に所属しているか確認
const membership = await getMembership(userId, currentOrgId)
if (!membership) {
  return { success: false, error: 'Not a member' }
}

// 4. ロールチェック
if (!hasRequiredRole(membership.role, requiredRole)) {
  return { success: false, error: 'Insufficient permissions' }
}
```

## 禁止事項 / やってはいけないこと

- ❌ RLSを一時的に無効化する・バイパスする
  - ✅ テストでもRLSは有効のまま
- ❌ 「テストだから全件取得してクライアント側でフィルタ」のような実装
  - ✅ サーバ側でorganization_idを指定して取得
- ❌ `owner` 不在の組織を作る/テストする
  - ✅ 常にownerが1名存在することを保証
- ❌ owner専用操作をappドメインに配置する
  - ✅ owner専用操作はadminドメインのみ
- ❌ admin権限とowner権限を混ぜる（adminに支払い変更を許可するなど）
  - ✅ 権限階層を明確に区別する
- ❌ フロント側だけでrole判定を完了させる
  - ✅ 必ずサーバ側で再チェック
- ❌ middlewareの挙動を「テスト通らないから」と勝手に簡略化・変更する
  - ✅ middlewareはセッションとorg_idの前提で動作する
- ❌ 監査ログ（activity_logs）の記録を省略する・弱める
  - ✅ 重要操作は必ず記録する

## 関連参照

- [CLAUDE.md - マルチテナントSaaSの全体ルール](../../CLAUDE.md#マルチテナントsaasの全体ルール)
- [CLAUDE.md - マルチテナント権限モデル](../../CLAUDE.md#マルチテナント権限モデル)
- [権限モデル仕様書](./roles-and-access.md)
- [組織切り替え仕様](./organization-switching.md)
- [マルチドメインパターン](../patterns/multi-domain.md)
- [Server Actionsパターン](../patterns/server-actions.md)

