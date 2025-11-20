# 機能名: 組織作成（ops発行）＋サブドメイン／課金の土台

## 1. 概要

当面の方針:

- 組織（organization）の作成は **ops ドメインのみ** から行う（手動契約前提）
- 組織ごとのサブドメインは `https://{slug}.app.example.com` 形式で割り当てる
- `slug` は URL と内部識別子として使うため **不変（immutable）＋グローバル一意**
- 課金・プラン情報はまず `organizations.plan_code/status` に簡易に持たせ、将来 `billing_accounts` 等に拡張する

このドキュメントは「ops から org を作るときの API/UI/DB 契約」を Claude Code 用に明示する。

---

## 2. 対象ドメインと画面

- ドメイン: `ops`（`ops.local.test:3004`, `ops.example.com`）
- Next.js アプリ: `apps/ops`
- 想定ルート:
  - 一覧: `/orgs` … 組織一覧（最初は簡易テーブルでOK）
  - 新規作成: `/orgs/new` … 組織作成フォーム

### 2.1 `/orgs/new` の役割

- 営業/CS が契約をクローズしたあと、**最初に org を発行する画面**
- 入力された slug に基づき、将来のアプリURL（`https://{slug}.app.example.com`）が決まる
- ここで決めた slug は **後から UI では変更できない**

---

## 3. DB スキーマ（organizations）

既存の `organizations` テーブルに、以下の前提を追加する（実際のマイグレーションは別途）。

```sql
create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),

  -- URL等に使う技術的ID。変更不可。
  slug text not null unique,

  -- 表示名（日本語OK）
  display_name text not null,

  -- 'active' | 'trial' | 'suspended' | 'cancelled'
  status text not null default 'active',

  -- 'free' | 'pro' | 'enterprise' 等の内部コード
  plan_code text not null default 'free',

  -- トライアル終了日時（必要な場合のみ）
  trial_ends_at timestamptz null,

  -- 手動契約メモ（請求先情報や営業メモなど自由記述）
  billing_notes text null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### 3.1 slug の制約

- 一意性:

```sql
create unique index if not exists organizations_slug_key
  on organizations(slug);
```

- 形式（小文字英数 + ハイフン / 先頭・末尾ハイフン禁止 / 連続ハイフン禁止は任意）:

```sql
alter table organizations
  add constraint organizations_slug_format_chk
  check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$');
```

- 予約語（`www`, `app`, `admin`, `ops`, `api` など）はアプリ側で弾く（DB CHECK ではなくアプリバリデーションでOK）。

### 3.2 slug の更新禁止（オプション）

slug は UI 上は編集不可とするが、**DBレベルでも UPDATE を禁止したい場合**は、トリガーで弾く。

```sql
create or replace function prevent_organizations_slug_update()
returns trigger as $$
begin
  if new.slug is distinct from old.slug then
    raise exception 'organizations.slug is immutable';
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_prevent_slug_update
  before update on organizations
  for each row
  execute function prevent_organizations_slug_update();
```

（トリガーを張らない場合でも、UI/Server Action 側で UPDATE を出さない前提とする）

---

## 4. 将来用: billing_accounts の形（メモ）

今すぐ実装する必要はないが、Stripe 等を導入する際の器として想定しておく。

```sql
create table if not exists billing_accounts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,

  -- 'manual' | 'stripe' 等
  provider text not null,

  external_customer_id text null,
  external_subscription_id text null,

  -- organizations.plan_code と同じコード体系を想定
  plan_code text not null,

  -- 'active' | 'trialing' | 'past_due' | 'canceled' 等
  status text not null,

  current_period_end timestamptz null,

  currency text null,
  unit_amount integer null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  canceled_at timestamptz null
);
```

運用イメージ:

- Phase1: `organizations.plan_code/status` だけ運用（billing_accounts はまだ使わないか、`provider='manual'` に限定）
- Phase2: Stripe 導入時に `billing_accounts` を追加し、Webhook からここを更新 → org側の `plan_code/status` を同期する Job を追加

---

## 5. ops: 組織作成 UI 仕様（/orgs/new）

### 5.1 画面概要

- パス: `apps/ops/app/orgs/new/page.tsx`
- 認可: `role === 'ops'` のみアクセス可能（それ以外は 403）
- 目的: 新しい org を発行し、`{slug}.app.example.com` を割り当てる土台を作る

### 5.2 入力項目

1. 組織名（表示名）
   - フィールド名: `displayName`
   - 型: string
   - 必須: 必須
   - バリデーション:
     - 長さ: 1〜100文字程度
   - 表示例:
     - ラベル: 「組織名」
     - プレースホルダ: 「例: Example 株式会社」

2. 組織 slug
   - フィールド名: `slug`
   - 型: string
   - 必須: 必須
   - バリデーション:
     - 正規表現: `^[a-z0-9]+(?:-[a-z0-9]+)*$`
     - 長さ: 3〜32文字程度
     - 予約語禁止: `['www','app','admin','ops','api']` 等は使用不可
     - DB 一意性: `organizations.slug` に既に存在していないこと
   - 表示例:
     - ラベル: 「組織 slug」
     - プレースホルダ: 「例: acme, acme-inc」
     - 補助テキスト: 「英小文字・数字・ハイフンのみ。作成後は変更できません。」
     - ライブプレビュー: `https://{slug}.app.example.com` をサブテキストとして表示

3. プラン（任意）
   - フィールド名: `planCode`
   - 型: enum
   - 必須: 任意（未指定時は `'free'`）
   - 値候補（当面）:
     - `free`
     - `pro`
     - `enterprise`
   - 表示例:
     - セレクトボックス: 「プラン」
     - 初期値: `free`

4. ステータス（任意）
   - フィールド名: `status`
   - 型: enum
   - 必須: 任意（未指定時は `'active'`）
   - 値候補:
     - `active`
     - `trial`
     - `suspended`
     - `cancelled`
   - 初期値は `active` でよいが、トライアル開始時は `trial` で作る運用も許容。

5. トライアル終了日（任意）
   - フィールド名: `trialEndsAt`
   - 型: Date / string (ISO)
   - 必須: `status === 'trial'` の場合のみ必須にするかは運用次第（Phase1では任意でも良い）。

6. 請求メモ（任意）
   - フィールド名: `billingNotes`
   - 型: string
   - 必須: 任意
   - 用途: 手動契約ID、請求書宛名、営業メモなどの自由記述。

7. 初期 owner のメールアドレス
   - フィールド名: `ownerEmail`
   - 型: string
   - 必須: 必須
   - バリデーション:
     - メール形式チェック
   - 挙動（Phase1の前提）:
     - Supabase Auth (`auth.admin.createUser`) で **新規 owner ユーザーを作成**する
     - メールアドレスが既に登録済みの場合はエラーとし、組織作成をロールバックする
     - 作成したユーザーを `profiles` / `memberships` に `role = 'owner'` で登録する
     - `user_org_context` にこの org をデフォルト org として upsert する（owner にとっての初期 org として扱う）

### 5.3 バリデーションフロー

フロントエンド:

- 各フィールドの必須チェック & 形式チェック
- slug フォーマット・予約語チェック

サーバ（Server Action）:

1. `role === 'ops'` であることを検証（それ以外は `success: false, error: 'Unauthorized'`）
2. slug フォーマット再チェック（信頼しない）
3. 予約語チェック
4. `organizations.slug` が未使用であることを DB で確認
5. INSERT 実行

---

## 6. Server Action 契約（擬似コード）

### 6.1 型

```ts
type OrgStatus = 'active' | 'trial' | 'suspended' | 'cancelled';
type OrgPlanCode = 'free' | 'pro' | 'enterprise';

interface CreateOrgInput {
  displayName: string;
  slug: string;
  planCode?: OrgPlanCode;
  status?: OrgStatus;
  trialEndsAt?: string | null; // ISO 8601 or null
  billingNotes?: string | null;
}

interface CreateOrgData {
  orgId: string;
  orgSlug: string;
  nextUrl: string; // 例: https://{slug}.app.example.com/
}
```

ActionResult 型は既存の `ActionResult<T>` を流用する想定。

```ts
export type ActionResult<T = undefined> =
  | { success: true; data?: T; nextUrl?: string }
  | { success: false; error: string; nextUrl?: string };
```

### 6.2 Server Action 本体（イメージ）

```ts
'use server';

import type { ActionResult } from '@repo/config/types';
import { createServerClient } from '@repo/db/server';

export async function createOrganization(
  input: CreateOrgInput
): Promise<ActionResult<CreateOrgData>> {
  const supabase = await createServerClient();
  const { data: { session } } = await supabase.auth.getSession();

  // 1. 認証 & ロールチェック（opsのみ許可）
  if (!session?.user?.id) {
    return { success: false, error: 'Not authenticated' };
  }

  const role = await getCurrentRoleForOps(supabase, session.user.id);
  if (role !== 'ops') {
    return { success: false, error: 'Unauthorized' };
  }

  // 2. 入力バリデーション（format / reserved words）
  const slug = input.slug.trim();
  const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  const reserved = new Set(['www', 'app', 'admin', 'ops', 'api']);

  if (!slugPattern.test(slug)) {
    return { success: false, error: 'Invalid slug format' };
  }
  if (reserved.has(slug)) {
    return { success: false, error: 'Reserved slug' };
  }

  // 3. 重複チェック
  const { data: existing } = await supabase
    .from('organizations')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();

  if (existing) {
    return { success: false, error: 'Slug already taken' };
  }

  const planCode = input.planCode ?? 'free';
  const status = input.status ?? 'active';

  // 4. INSERT
  const { data: org, error } = await supabase
    .from('organizations')
    .insert({
      slug,
      display_name: input.displayName,
      plan_code: planCode,
      status,
      trial_ends_at: input.trialEndsAt ?? null,
      billing_notes: input.billingNotes ?? null,
    })
    .select('id, slug')
    .single();

  if (error || !org) {
    return { success: false, error: error?.message ?? 'Failed to create organization' };
  }

  const baseDomain = process.env.NEXT_PUBLIC_APP_BASE_DOMAIN ?? 'app.example.com';
  const nextUrl = `https://${org.slug}.${baseDomain}/`;

  return {
    success: true,
    data: {
      orgId: org.id,
      orgSlug: org.slug,
      nextUrl,
    },
    nextUrl,
  };
}
```

※ `getCurrentRoleForOps` は「ops ロールかどうかを判定する既存ヘルパー」想定。なければ別途実装。

---

## 7. 組織設定画面での slug 取り扱い

- `apps/ops/app/orgs/[orgId]/settings/page.tsx` のような設定画面がある場合:
  - 表示項目:
    - 組織名（display_name）: 編集可能
    - 組織 slug: **テキスト表示のみ（input は disabled / readOnly）**
      - 「URL や外部リンクに使用するため、変更できません」と注意書きを出す
    - plan_code / status / billing_notes 等は ops が編集可能
- org の削除・凍結等のルールは別仕様（tenancy / admin 権限仕様）で定義する。

---

## 8. サブドメインとの対応関係

- `organizations.slug` と app サブドメインは 1:1 で対応する:
  - `organizations.slug = 'acme'` → `https://acme.app.example.com/...`
- Vercel / DNS 側の想定:
  - `app.example.com` および `*.app.example.com` を apps/app プロジェクトに向ける
  - どの `{slug}.app.example.com` も同じ apps/app に到達し、middleware + getCurrentOrg() が org を解決する

以上を前提に、Claude Code は:

- `apps/ops` に org 作成フォーム + Server Action を実装
- `organizations` の slug 周りの制約に合わせたバリデーション/エラー処理を実装
- `nextUrl` として `{slug}.app...` を返し、今後の画面遷移に利用

という形でコード生成すればよい。  
（このファイルが「ops からの org 作成＋サブドメイン前提」の唯一の仕様書として振る舞う想定）
