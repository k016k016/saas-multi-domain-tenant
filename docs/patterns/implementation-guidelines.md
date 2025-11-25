# 実装ガイドライン

本ドキュメントは、コードベースの一貫性とセキュリティを保つための実装ガイドラインをまとめています。

## 1. Ops権限の検証

### 必須要件

Opsドメイン（`/apps/ops`）のすべてのServer Actionで、**middleware + Server Action の二重チェック**を実装する必要があります。

### 実装パターン

```typescript
'use server';

import { isOpsUser } from '@repo/config';

export async function opsAction(data: any) {
  // 1. Ops権限チェック（必須 - 最優先）
  const isOps = await isOpsUser();
  if (!isOps) {
    return {
      success: false,
      error: 'Unauthorized: Ops権限が必要です'
    };
  }

  // 2. バリデーション
  // ...

  // 3. ビジネスロジック
  // ...

  return { success: true };
}
```

### チェック箇所

Opsドメインのすべてのアクション：
- `/apps/ops/app/orgs/new/actions.ts` - createOrganization()
- `/apps/ops/app/orgs/[id]/actions.ts` - updateOrganization(), archiveOrganization()
- その他の管理操作

### Defense in Depth（多層防御）

middlewareでの制御に加えて、Server Action内でも必ず検証することで、多層防御を実現します。

理由：
- middlewareのバグや設定ミスがあっても、Server Action側で防御できる
- 将来的なリファクタリングでmiddlewareが変更されても安全
- セキュリティはレイヤーごとに独立して実装すべき

## 2. activity_logs の命名規則

### 統一ルール

activity_logsの`action`フィールドは**dot notation**で統一します。

### 命名パターン

```
{リソース}.{アクション}
```

- リソース名：単数形（member, org, payment）
- アクション：過去分詞（invited, created, updated, deleted）
- 複合語：アンダースコア（role_changed, ownership_transferred）

### 標準的なアクション名

#### メンバー関連
```typescript
'member.invited'           // メンバー招待
'member.removed'           // メンバー削除
'member.role_changed'      // ロール変更
'member.suspended'         // 一時停止
'member.reactivated'       // 再有効化
```

#### 組織関連
```typescript
'org.created'              // 組織作成
'org.updated'              // 組織更新
'org.frozen'               // 組織凍結
'org.unfrozen'             // 凍結解除
'org.archived'             // 組織廃止
'org.ownership_transferred' // owner権限譲渡
```

#### 支払い関連
```typescript
'payment.updated'          // 支払い情報更新
'payment.method_added'     // 支払い方法追加
'payment.method_removed'   // 支払い方法削除
'payment.failed'           // 支払い失敗
```

#### プロジェクト関連
```typescript
'project.created'          // プロジェクト作成
'project.updated'          // プロジェクト更新
'project.deleted'          // プロジェクト削除
'project.transferred'      // プロジェクト移管
```

### 実装例

```typescript
await supabase
  .from('activity_logs')
  .insert({
    org_id: org.orgId,
    user_id: user.id,
    action: 'member.role_changed', // dot notation
    payload: {
      target_user_id: targetUserId,
      old_role: 'member',
      new_role: 'admin'
    }
  });
```

### 禁止事項

以下の命名パターンは使用しない：
- ❌ snake_case のみ: `user_invited`, `payment_updated`
- ❌ 動詞原形: `invite_user`, `update_payment`
- ❌ 不明確な名前: `action1`, `do_something`

## 3. セキュリティ要件

### 3.1 RLS（Row Level Security）の前提

すべてのデータベース操作はRLSを前提とします。

#### 基本原則

1. **RLSポリシーに依存**：アプリケーション層でのフィルタリングに頼らない
2. **org_id の必須性**：すべてのテナントデータは`org_id`を持つ
3. **deleted_at の考慮**：論理削除を実装する場合、RLSポリシーの更新が必須

#### 正しい実装例

```typescript
// ✅ 正しい：RLSが適用される
const { data } = await supabase
  .from('projects')
  .select('*')
  .eq('org_id', org.orgId); // RLSがさらに制限する
```

#### 禁止パターン

```typescript
// ❌ 危険：全件取得してアプリ側でフィルタ
const { data } = await supabase
  .from('projects')
  .select('*');
const filtered = data.filter(p => p.org_id === org.orgId);
```

### 3.2 論理削除とRLSの関係

論理削除（`deleted_at`カラム）を実装する場合、**すべてのRLSポリシーを更新**する必要があります。

#### 必要な対応

```sql
-- すべてのRLSポリシーに条件追加
CREATE POLICY "users_can_view_own_data" ON profiles
FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  AND org_id = current_setting('app.current_org_id')::uuid
  AND deleted_at IS NULL  -- ← この条件を追加
);

-- インデックスも追加
CREATE INDEX idx_profiles_org_deleted
ON profiles(org_id, deleted_at);
```

#### 影響範囲

- profiles
- organizations
- projects
- activity_logs（監査ログは論理削除しない可能性もあり）
- その他のすべてのテナントデータ

#### 実装タイミング

論理削除の実装は、以下の手順で慎重に行う：

1. RLSポリシーの全件レビュー
2. 各ポリシーに`deleted_at IS NULL`条件を追加
3. インデックスの追加
4. アプリケーション層での論理削除処理実装
5. **すべてのE2Eテスト**を実行して確認

### 3.3 権限チェックの多層防御

各レイヤーで独立して権限をチェックします。

```typescript
export async function criticalAction(data: any) {
  // Layer 1: 認証チェック
  const session = await getSession();
  if (!session) {
    return { success: false, error: '認証が必要です' };
  }

  // Layer 2: 組織所属チェック
  const org = await getCurrentOrg();
  if (!org) {
    return { success: false, error: '組織が見つかりません' };
  }

  // Layer 3: ロール権限チェック
  const role = await getCurrentRole();
  if (!['owner', 'admin'].includes(role.role)) {
    return { success: false, error: 'アクセス権限がありません' };
  }

  // Layer 4: リソースレベルの権限チェック
  const resource = await checkResourceAccess(data.resourceId, session.userId);
  if (!resource) {
    return { success: false, error: 'このリソースにアクセスできません' };
  }

  // ここまで来て初めてビジネスロジックを実行
  // ...
}
```

### 3.4 Open Redirect防止

遷移先URLは必ずサーバー側で生成します。

#### 安全な実装

```typescript
// ✅ 安全：サーバー側で生成
export async function safeAction(targetOrgSlug: string) {
  // ホワイトリスト検証
  const allowedSlugs = await getUserOrganizationSlugs(userId);
  if (!allowedSlugs.includes(targetOrgSlug)) {
    return { success: false, error: 'アクセス権限がありません' };
  }

  // サーバー側でURL構築
  const nextUrl = `/org/${targetOrgSlug}/dashboard`;

  return { success: true, nextUrl };
}
```

#### 危険な実装

```typescript
// ❌ 危険：ユーザー入力をそのまま使用
export async function unsafeAction(userProvidedUrl: string) {
  return {
    success: true,
    nextUrl: userProvidedUrl // Open Redirectの脆弱性
  };
}
```

### 3.5 セッション管理

- **Cookie-only**：セッション情報はCookieのみに保存（localStorageは使用しない）
- **HttpOnly**：セッションCookieは`HttpOnly`フラグを設定
- **Secure**：本番環境では`Secure`フラグを設定
- **SameSite**：CSRF対策として`SameSite=Lax`以上を設定

## 4. 監査ログの要件

### 記録必須の操作

以下の操作は必ず`activity_logs`に記録する：

#### 高リスク操作（admin/ops）
- メンバー招待・削除・ロール変更
- owner権限の譲渡
- 組織の凍結・解除・廃止
- 支払い情報の変更
- APIキーの生成・削除

#### ユーザー操作（app）
- ログイン（失敗含む）
- パスワード変更
- 2FA設定変更
- データエクスポート

### ログの構造

```typescript
interface ActivityLog {
  org_id: string;          // 組織ID（必須）
  user_id: string;         // 実行ユーザーID（必須）
  action: string;          // アクション名（dot notation）
  payload: any;            // 操作の詳細情報
  created_at: timestamp;   // 記録日時（自動）

  // 将来的に追加検討
  ip_address?: string;     // IPアドレス
  user_agent?: string;     // User-Agent
  session_id?: string;     // セッションID
}
```

### 実装例

```typescript
'use server';

export async function changeUserRole(userId: string, newRole: Role) {
  const supabase = await createServerClient();
  const org = await getCurrentOrg();
  const session = await getSession();

  // 権限チェック
  // ...

  // ロール変更
  const { data: oldProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', userId)
    .eq('org_id', org.orgId)
    .single();

  await supabase
    .from('profiles')
    .update({ role: newRole })
    .eq('user_id', userId)
    .eq('org_id', org.orgId);

  // 監査ログ記録（必須）
  await supabase
    .from('activity_logs')
    .insert({
      org_id: org.orgId,
      user_id: session.userId,
      action: 'member.role_changed',
      payload: {
        target_user_id: userId,
        old_role: oldProfile.role,
        new_role: newRole
      }
    });

  return { success: true };
}
```

## 5. エラーハンドリング

### ユーザー向けメッセージ

エラーメッセージは日本語でユーザーフレンドリーに：

```typescript
// ✅ 良い例
return {
  success: false,
  error: 'アクセス権限がありません'
};

// ❌ 悪い例
return {
  success: false,
  error: 'Unauthorized: insufficient role permissions for resource access'
};
```

### 開発者向けログ

詳細なエラー情報はサーバー側のログに出力：

```typescript
try {
  // ... 処理
} catch (error) {
  // サーバー側ログ（本番でも出力）
  console.error('[actionName] Failed to process:', {
    error: error.message,
    userId: session.userId,
    orgId: org.orgId,
    // スタックトレースは開発環境のみ
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
  });

  // ユーザー向けメッセージ（詳細を隠す）
  return {
    success: false,
    error: 'エラーが発生しました。もう一度お試しください。'
  };
}
```

## 6. チェックリスト

新しいServer Action実装時：

### セキュリティ
- [ ] 権限チェックを実装している
- [ ] RLSを前提としたクエリになっている
- [ ] ユーザー入力を信用していない（再検証している）
- [ ] Open Redirect対策をしている
- [ ] エラー時にスタックトレースを露出していない

### パターン遵守
- [ ] `redirect()` を使用していない
- [ ] `ActionResult<T>` 型で返却している
- [ ] activity_logsを記録している（高リスク操作の場合）
- [ ] dot notation でアクション名を定義している

### コード品質
- [ ] バリデーションを実装している
- [ ] エラーハンドリングを実装している
- [ ] ユーザー向けメッセージが日本語でわかりやすい
- [ ] 必要なテストを作成している

## 7. 関連ドキュメント

- [Server Actions パターン](./server-actions.md) - 基本パターン
- [技術的負債](./technical-debt.md) - 改善事項の詳細
- [E2Eテストガイド](./e2e-testing.md) - テスト実行方法