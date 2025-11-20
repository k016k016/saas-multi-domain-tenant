# 機能名: 組織作成（ops専用）/ Org Creation from OPS

この仕様は「当面、組織(org)は ops ドメインからのみ作成する」前提のもの。  
Self-serve サインアップを入れるときは、この仕様をベースに `www` / `app` から同じAPIを叩く形で拡張する。

---

## 1. 概要

- **作成主体**: `ops` ロールのみ（`ops` ドメインの UI）
- **目的**:
  - 新しいテナント用の org レコードを作成する
  - URL 用の `slug` を決める（`{slug}.app.example.com`）
  - 初期プラン・ステータスをセットする（手動契約前提）
  - 必要なら最初の owner ユーザーを紐付ける／招待する

---

## 2. データモデル前提

### 2.1 organizations テーブル（抜粋）

- `id uuid` … PK
- `slug text not null unique`
  - 形式: 小文字英数字＋ハイフンのみ
  - 正規表現: `^[a-z0-9]+(?:-[a-z0-9]+)*$`
  - 予約語（使用不可）例: `www`, `app`, `admin`, `ops`
  - 一度作成したら「UIからは変更不可」（実質 immutable）
- `display_name text not null`
  - 表示名（日本語OK、後から変更可）
- `status text not null default 'active'`
  - 候補: `'active' | 'trial' | 'suspended' | 'cancelled'`
- `plan_code text not null default 'free'`
  - 候補例: `'free' | 'pro' | 'enterprise'`
- `trial_ends_at timestamptz null`
- `billing_notes text null`
  - サブスク/契約メモ用（営業メモや請求IDなど）
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

### 2.2 関連テーブル（参照のみ）

- `memberships` … org とユーザーの紐付け＋role（owner/admin/member）
- `user_org_context` … 各ユーザーのデフォルト org（サブドメイン未指定時に使用）

初期実装では:
- org 作成時に `memberships` / `user_org_context` を「必須ではない」。  
- 最初の owner の紐付けは ops UI の別アクション（例: 「owner 招待」）で行ってもよい。

---

## 3. ops側 UI 仕様

### 3.1 画面位置

- パス例: `apps/ops/app/orgs/new`（RSC + Server Action）
- ops ナビゲーションの「Organizations > New」から遷移

### 3.2 入力項目

1. **組織名（display_name）**
   - ラベル: `組織名`
   - 型: text
   - 必須: 必須
   - バリデーション:
     - 1〜100文字程度（上限はUIでガード）
   - エラーメッセージ例:
     - 空: `組織名を入力してください`

2. **組織 slug（slug）**
   - ラベル: `組織スラッグ`
   - 説明文:
     - `URLに使われる識別子です。一度作成すると変更できません。`
     - `英小文字・数字・ハイフンのみ（例: acme, acme-inc）。`
   - 型: text
   - 必須: 必須
   - クライアントバリデーション:
     - 正規表現: `^[a-z0-9]+(?:-[a-z0-9]+)*$`
     - 長さ: 3〜32文字
     - 予約語 NG: `www`, `app`, `admin`, `ops`
   - サーババリデーション:
     - 同上の形式チェック
     - `organizations.slug` の unique 制約違反 → 「すでに利用されています」
   - エラーメッセージ例:
     - 形式違反: `英小文字と数字、ハイフンのみ使用できます（先頭と末尾のハイフンは不可）`
     - 予約語: `このスラッグは使用できません`
     - 重複: `このスラッグは既に利用されています`
   - URLプレビュー:
     - 入力中に `https://{slug}.app.example.com` を表示（ローカルなら `https://{slug}.app.local.test:3002`）

3. **プラン（plan_code）**
   - ラベル: `プラン`
   - 型: select
   - 選択肢例:
     - `free`（無料）
     - `pro`
     - `enterprise`
   - 必須: 必須（デフォルト `free`）

4. **ステータス（status）**
   - ラベル: `ステータス`
   - 型: select
   - 選択肢:
     - `active`
     - `trial`
     - `suspended`
     - `cancelled`
   - 初期値: `active` もしくは `trial`（運用方針に合わせて決める）

5. **トライアル終了日（trial_ends_at）※任意**
   - ラベル: `トライアル終了日`
   - 型: date/time picker
   - 必須: `status = 'trial'` のときのみ必須（それ以外は null 許容）

6. **請求メモ（billing_notes）※任意**
   - ラベル: `請求メモ / 内部メモ`
   - 型: textarea
   - 用途:
     - 営業・CS 内部メモ
     - 契約ID、請求先担当者名など

（将来拡張）  
7. **初期 owner メールアドレス（optional）**
   - v1 では **未実装でもよい**。  
   - 将来: 入力があれば `memberships` / 招待メールを自動作成する。

### 3.3 ボタン / アクション

- `組織を作成する` ボタン
  - 有効条件:
    - 必須項目がすべて入力済み
    - クライアント側のバリデーションがすべてパス
  - クリック時:
    - Server Action を呼び出し
    - 成功時: 成功メッセージ＋ org 詳細ページへの遷移
      - `nextUrl = /orgs/{orgId}` または `/orgs/{slug}`

---

## 4. Server Action / API 契約

### 4.1 型定義（イメージ）

```ts
type CreateOrgInput = {
  displayName: string;
  slug: string;
  planCode: 'free' | 'pro' | 'enterprise';
  status: 'active' | 'trial' | 'suspended' | 'cancelled';
  trialEndsAt?: string | null; // ISO8601
  billingNotes?: string | null;
};

type ActionResult<T = undefined> =
  | { success: true; data?: T; nextUrl?: string }
  | { success: false; error: string; fieldErrors?: Record<string, string>; nextUrl?: string };
```

### 4.2 入力バリデーション（サーバ側）

1. **権限チェック**
   - `getCurrentRole()` などで ops ロール確認
   - ops 以外からの呼び出しは `{ success: false, error: 'Unauthorized' }`

2. **displayName**
   - 空 or 長さオーバー → `fieldErrors.displayName`

3. **slug**
   - 正規表現チェック（`^[a-z0-9]+(?:-[a-z0-9]+)*$`）
   - 長さ 3〜32 文字
   - 予約語チェック（`www/app/admin/ops` など）
   - unique チェック:
     - DB INSERT 時に unique 制約違反が出たら `fieldErrors.slug = 'このスラッグは既に利用されています'`

4. **planCode**
   - 許可された値かをチェック

5. **status / trialEndsAt**
   - status が `trial` の場合、`trialEndsAt` 必須
   - その他の status の場合は `trialEndsAt` は無視 or null

6. **billingNotes**
   - 長さ上限（例: 1000 文字）程度に制限

### 4.3 DB 操作の順序（トランザクション）

1. トランザクション開始
2. `organizations` に INSERT
   - カラム: `slug`, `display_name`, `plan_code`, `status`, `trial_ends_at`, `billing_notes`
3. （v1 では任意）必要なら `activity_logs` に「org 作成」を記録
4. コミット

エラー時:
- バリデーションエラー → `success: false`, `fieldErrors` を返す
- DBエラー → `success: false`, `error: 'internal_error'` など（詳細メッセージはログ側に出す）

### 4.4 戻り値

成功時:

```ts
{
  success: true,
  data: { orgId, slug },
  nextUrl: `/orgs/${slug}` // ops 内の org 詳細ページ
}
```

失敗時:

```ts
{
  success: false,
  error: 'Validation failed',
  fieldErrors: {
    slug: 'このスラッグは既に利用されています'
  }
}
```

---

## 5. 将来の拡張ポイント（サブスク連携）

この仕様は「手動契約（ops管理）」を前提にしているが、将来 Stripe 等と統合しやすいように以下を意識する。

- `plan_code` / `status` は **org の論理状態** として運用する
  - 支払遅延 → Stripe Webhook → `billing_accounts` 更新 → `organizations.status = 'suspended'` に同期、など
- `billing_accounts` テーブルを追加する場合は:
  - `org_id` で `organizations.id` に紐付け
  - `provider` / `external_customer_id` / `external_subscription_id` などを保持
  - 初期は `provider='manual'` のレコードを ops UI から作ってもよい

---

## 6. Claude Code への前提共有メモ

Claude Code に実装を依頼する際は、このファイルの要点として以下を伝える:

- org は **ops ドメインからのみ作成**、slug は org 作成時に一度だけ入力し、変更不可。
- slug は:
  - 小文字英数字＋ハイフン
  - 3〜32 文字
  - 予約語（www/app/admin/opsなど）禁止
  - `organizations.slug` で unique
- ops の UI は:
  - 組織名／slug／plan_code／status／trial_ends_at／billing_notes を入力
  - slug 入力時に URL プレビューを出す
  - エラーはフィールド単位に表示
- Server Action は:
  - `{ success, error, fieldErrors, nextUrl }` 形式を返す
  - redirect() は使わない
  - 権限チェック → バリデーション → INSERT → activity_logs（任意）の順で処理する

この仕様に沿って、`apps/ops` 側に画面＋Server Actionを生やす実装を依頼できる。

