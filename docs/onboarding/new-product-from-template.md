# 新しいプロダクトをこのスターターに載せるときのガイド

このドキュメントは、「このリポジトリを土台にして、新しいSaaSプロダクト（業務ドメイン）を追加する」ための手順と考え方をまとめたものです。

目的は次の2つです。

- どんなプロダクトでも共通する「やるべきこと・守るべき境界」を明文化する
- 具体的な実装順序のテンプレートを用意し、「何から手を付ければいいか」を迷わないようにする

---

## 全体像

新しいプロダクトを載せるときは、だいたい次の順序になります。

1. **ドメインモデリング**: 「何を管理するプロダクトか」を言語化し、テーブル・状態遷移を決める
2. **DBスキーマ & RLS**: SupabaseのマイグレーションにテーブルとRLSポリシーを追加する
3. **app/admin の責務分離**: どの画面を app に置き、どの画面を admin に置くかを決める
4. **Server Actions & 認可**: `@repo/config` / `@repo/db` を使って Server Action を実装する
5. **監査ログ (activity_logs)**: どの操作を `logActivity()` で記録するかを決めて実装する
6. **E2E テスト**: 境界（ロール×ドメイン×org）をまたいだエンドツーエンドテストを書く

以降で、それぞれのステップをもう少し具体的に説明します。

---

## 1. ドメインモデリング

まずは「何を管理するプロダクトか」を、アプリ固有の言葉で整理します。

例:

- タスク管理プロダクトなら: `projects`, `tasks`, `task_comments`
- 申請ワークフローなら: `forms`, `form_responses`, `approvals`

その上で、次の点を明文化しておくと、その後の設計が楽になります。

- エンティティとその関係（ER 図レベル）
- 状態遷移（例: `draft -> active -> archived`）
- 「組織ごとに完全に分離される」ものと、「共有される」もの

このスターターでは、**基本的にすべての業務データは org 単位で完全に分離する**前提です。
「共有される」データ（例: テンプレートマスタなど）を置く場合でも、RLSと整合性が取れるように設計してください。

---

## 2. DB スキーマ & RLS

### 2-1. マイグレーションファイルの追加

新しいテーブルは、`infra/supabase/migrations/` にマイグレーションを追加して定義します。

命名例:

- `YYYYMMDDHHMMSS_add_tasks_tables.sql`

最低限、以下を意識します。

- `org_id` を必ず持たせる（org 境界）
- `created_at`, `updated_at` を持たせる
- `id` は `uuid` など一意なキーにする

### 2-2. RLS の設計

このリポジトリでは、**RLS を無効化しない**ことが大前提です（`infra/supabase/RLS.md` 参照）。

一般的なパターン:

- `SELECT`: 同一 `org_id` に所属するメンバーのみ
- `INSERT`: その org のメンバー（role に応じて追加制限する場合も可）
- `UPDATE` / `DELETE`: 多くの場合 admin/owner のみ（アプリ側のロール判定と併用）

RLS の例やポリシーの書き方は、既存のテーブル（`organizations`, `profiles`, `activity_logs` など）と `infra/supabase/RLS.md` を参照してください。

---

## 3. app / admin の責務分離

新しいプロダクト機能をどこに置くかは、**ドメインの責務とリスク**で決めます。

基本ルール（README の方針を再掲）:

- `app`: 日常業務 UI（member/admin/owner 全員が使う）
- `admin`: 組織運用・高リスク操作（admin/owner のみ）
- `ops`: ベンダー側の横断コンソール（本番運用担当者のみ）

例: タスク管理プロダクトの場合

- `apps/app/app/projects/*`: 自分のタスクやプロジェクトを見る・更新する UI
- `apps/admin/app/project-settings/*`: 組織全体のプロジェクト設定、ワークフロー設定など高リスク UI

「とりあえず全部 app に置く」のは楽ですが、**高リスク操作は admin に寄せる**のがこのスターターの前提です。

---

## 4. Server Actions & 認可

### 4-1. 共通ヘルパーの利用

新しい機能の Server Action を書くときは、必ず既存の共通ヘルパーを使います。

- 認証・org コンテキスト:
  - `@repo/config` の `getCurrentOrg()`, `getCurrentRole()`, `hasRole()`
- Supabase クライアント:
  - `@repo/db` の `createServerClient()`（RLS 前提）
  - 管理 API が必要なときだけ `getSupabaseAdmin()` を使用（慎重に）

### 4-2. Server Action の基本ルール

pattern ドキュメントにもある通り、Server Action では以下を守ります。

- `redirect()` を使わず、`{ success, nextUrl?, error? }` を返す
- ロールチェックはフロントだけに任せず、Server Action 内でも行う
- すべてのクエリで `org_id` を明示指定する

例（疑似コード）:

```typescript
'use server';

import { getCurrentOrg, getCurrentRole, hasRole } from '@repo/config';
import { createServerClient, logActivity } from '@repo/db';

export async function createTask(formData: FormData) {
  const roleContext = await getCurrentRole();
  const currentRole = roleContext?.role;

  if (!currentRole || !hasRole(currentRole, 'member')) {
    return { success: false, error: '権限がありません' };
  }

  const org = await getCurrentOrg();
  if (!org) {
    return { success: false, error: '組織情報が見つかりません' };
  }

  const supabase = await createServerClient();

  // org_id を必ず指定する
  const { error } = await supabase.from('tasks').insert({
    org_id: org.orgId,
    title: formData.get('title'),
    // ...
  });

  if (error) {
    console.error('[createTask] insert error', error);
    return { success: false, error: 'タスクの作成に失敗しました' };
  }

  // 監査ログは次のセクション参照

  return { success: true, nextUrl: '/tasks' };
}
```

---

## 5. 監査ログ (activity_logs)

このスターターでは、**高リスク操作は必ず `activity_logs` に記録する**方針です。
（詳細は `docs/operations/activity-logs.md` と `docs/operations/organization-lifecycle.md` を参照）

### 5-1. どの操作を記録するか

代表的には次のようなものです。

- 組織レベルの設定変更
- 他ユーザーに影響する操作（権限変更、削除など）
- 課金・支払いに関わる操作

新しいプロダクトでも、同じ考え方で「後からトラブルになりそうな操作」を洗い出し、ログ対象にします。

### 5-2. `logActivity()` の呼び出し

`@repo/db` がエクスポートしている `logActivity()` を使うと、共通形式で監査ログを記録できます。

例（擬似コード）:

```typescript
import { getSupabaseAdmin, logActivity } from '@repo/db';

// Server Action 内など
const supabaseAdmin = getSupabaseAdmin();

const logResult = await logActivity(supabaseAdmin, {
  orgId: org.orgId,
  userId: currentUserId,
  action: 'task.created',
  payload: {
    task_id: taskId,
    title,
  },
});

if (logResult.error) {
  console.warn('[createTask] activity log failed', logResult.error);
}
```

`action` の名前は、`"ドメイン.動詞"`（例: `member.invited`, `project.archived`）のように、
既存のものと揃えた形式で付けると後から集計しやすくなります。

---

## 6. E2E テスト

このリポジトリは、「境界（ドメイン × ロール × org）」をちゃんとテストする方針です。

新しいプロダクトを追加したら、少なくとも次のようなテストを書くことを推奨します。

- member/admin/owner でのアクセス可否（403/404/200）
- 異なる org サブドメインでの挙動（`acme.app.local.test` と `beta.app.local.test` など）
- 監査ログが正しく記録されているか

Playwright のパターンやテンプレートは `docs/patterns/e2e-testing.md` と
`docs/patterns/e2e-test-templates.md` を参照してください。

---

## 7. 「変えてよいところ」と「変えてはいけないところ」

最後に、このスターターを使うときに意識してほしい境界をまとめます。

**変えてよい / プロダクトごとに好きに設計してよいもの**

- 業務ドメインのテーブル構造（例: tasks, forms, invoices …）
- app/admin 内の画面構成・UI デザイン
- 監査ログの `action` 名や payload の詳細
- 通知・メールの内容や送信条件

**変えてはいけない / 原則を守るべきもの**

- ドメイン分割（`www / app / admin / ops`）とそれぞれの責務
- ロール階層（`member ⊂ admin ⊂ owner`、ops は別枠）
- RLS を有効にしたまま org_id でスコープすること
- org コンテキストを DB で管理する方針（Cookie に org_id を持たせない）
- 高リスク操作に対する監査ログ記録の文化

このガイドに沿って新しい機能を追加していけば、「どのプロダクトでも共通してほしい安全性」と
「各プロダクト固有の業務ロジック」をきれいに分離したまま、雛形の上にプロダクトを積み上げていけます。

