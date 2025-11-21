# 組織ライフサイクル管理ガイド

組織（Organization）の作成から廃止までのライフサイクルと、各フェーズでの運用手順を説明します。

---

## 組織ステータス

### 状態遷移図

```
[新規作成] → [Active] → [Frozen] → [Archived]
                ↓          ↑
              [Active] ← [Frozen]
```

### ステータス定義

| ステータス | 説明 | アクセス可否 | 操作可能権限 |
|----------|------|------------|-------------|
| `active` | 通常運用中 | ✅ 可能 | member/admin/owner |
| `frozen` | 一時停止（支払い滞納など） | ❌ 読み取り専用 | owner のみ |
| `archived` | 廃止済み（削除前段階） | ❌ 不可 | ops のみ |

---

## 1. 組織作成

### 作成フロー

1. **新規ユーザーサインアップ**（将来実装）
   - `www/app/signup` でアカウント作成
   - サインアップ時に組織名を入力
   - 自動的に組織を作成し、ユーザーを `owner` として登録

2. **OPS経由での組織作成**（現在実装）
   - `ops/app/orgs/new` でOPS権限者が組織を作成
   - 初期ownerを指定

### 実装例（OPS経由）

```typescript
// apps/ops/app/orgs/new/actions.ts
export async function createOrganization(data: {
  name: string
  slug: string
  ownerId: string
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // 1. 組織を作成
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .insert({
      name: data.name,
      slug: data.slug,
      status: 'active',
      is_active: true,
    })
    .select()
    .single()

  if (orgError) {
    return { success: false, error: orgError.message }
  }

  // 2. ownerプロフィールを作成
  const { error: profileError } = await supabase
    .from('profiles')
    .insert({
      id: data.ownerId,
      org_id: org.id,
      role: 'owner',
    })

  if (profileError) {
    return { success: false, error: profileError.message }
  }

  // 3. 監査ログ記録
  await logActivity(org.id, user!.id, 'org.created', {
    org_name: data.name,
    org_slug: data.slug,
    owner_id: data.ownerId,
  })

  return { success: true, orgId: org.id }
}
```

### 作成時の必須条件

- [ ] 組織名（name）は必須
- [ ] スラッグ（slug）は一意かつURL安全（`^[a-z0-9-]+$`）
- [ ] 初期ownerは必ず1人指定（owner不在の組織は禁止）
- [ ] 初期ステータスは `active`

---

## 2. 組織凍結（Frozen）

### 凍結の理由

- 支払い滞納
- 利用規約違反
- セキュリティインシデント
- ユーザーからの一時停止依頼

### 凍結時の挙動

- すべてのユーザーが **読み取り専用** になる
- データの変更・削除は不可
- 新規メンバー招待は不可
- ownerは凍結解除リクエストを送信可能

### 実装例（owner権限）

```typescript
// apps/admin/app/org-settings/actions.ts
export async function freezeOrganization(reason: string) {
  const { orgId, userId, role } = await getCurrentContext()

  // ownerのみ実行可能
  if (role !== 'owner') {
    return { success: false, error: 'Forbidden' }
  }

  const supabase = createClient()

  // 組織を凍結
  const { error } = await supabase
    .from('organizations')
    .update({
      status: 'frozen',
      is_active: false,
    })
    .eq('id', orgId)

  if (error) {
    return { success: false, error: error.message }
  }

  // 監査ログ記録
  await logActivity(orgId, userId, 'org.frozen', {
    reason,
    frozen_by: 'owner',
  })

  return { success: true }
}
```

### 実装例（OPS権限）

```typescript
// apps/ops/app/orgs/[orgId]/actions.ts
export async function forceFreezeOrganization(orgId: string, reason: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // OPS権限チェック
  const isOps = await isOpsUser()
  if (!isOps) {
    return { success: false, error: 'Forbidden' }
  }

  // 組織を強制凍結
  await supabase
    .from('organizations')
    .update({
      status: 'frozen',
      is_active: false,
    })
    .eq('id', orgId)

  // 監査ログ記録
  await logActivity(orgId, user!.id, 'org.force_frozen', {
    reason,
    frozen_by: 'ops',
  })

  return { success: true }
}
```

---

## 3. 凍結解除（Unfrozen）

### 解除条件

- 支払い問題が解決
- 利用規約違反が是正
- セキュリティインシデントが収束

### 実装例（owner権限）

```typescript
// apps/admin/app/org-settings/actions.ts
export async function unfreezeOrganization() {
  const { orgId, userId, role } = await getCurrentContext()

  if (role !== 'owner') {
    return { success: false, error: 'Forbidden' }
  }

  const supabase = createClient()

  // 組織を再開
  const { error } = await supabase
    .from('organizations')
    .update({
      status: 'active',
      is_active: true,
    })
    .eq('id', orgId)

  if (error) {
    return { success: false, error: error.message }
  }

  // 監査ログ記録
  await logActivity(orgId, userId, 'org.unfrozen', {
    unfrozen_by: 'owner',
  })

  return { success: true }
}
```

---

## 4. 組織廃止（Archived）

### 廃止の理由

- ユーザーからの削除依頼
- 長期間の非アクティブ
- 違反による強制削除

### 廃止フロー

1. **owner権限での廃止リクエスト**
   - `admin/app/org-settings` で廃止ボタンをクリック
   - 確認ダイアログで組織名を入力（誤操作防止）
   - ステータスを `archived` に変更

2. **OPS権限での強制廃止**
   - `ops/app/orgs/[orgId]` で強制廃止
   - 理由を記録

3. **データ削除（将来実装）**
   - 廃止から30日後に自動的に完全削除
   - 削除前にバックアップ取得

### 実装例（owner権限）

```typescript
// apps/admin/app/org-settings/actions.ts
export async function archiveOrganization(confirmationName: string) {
  const { orgId, userId, role } = await getCurrentContext()

  if (role !== 'owner') {
    return { success: false, error: 'Forbidden' }
  }

  const supabase = createClient()

  // 組織名確認
  const { data: org } = await supabase
    .from('organizations')
    .select('name')
    .eq('id', orgId)
    .single()

  if (org.name !== confirmationName) {
    return { success: false, error: 'Organization name mismatch' }
  }

  // 組織を廃止
  const { error } = await supabase
    .from('organizations')
    .update({
      status: 'archived',
      is_active: false,
    })
    .eq('id', orgId)

  if (error) {
    return { success: false, error: error.message }
  }

  // 監査ログ記録
  await logActivity(orgId, userId, 'org.archived', {
    archived_by: 'owner',
  })

  return { success: true }
}
```

---

## 5. owner権限譲渡

### 譲渡フロー

1. **現在のownerが新ownerを指名**
   - `admin/app/org-settings` で譲渡対象メンバーを選択
   - 確認ダイアログで譲渡を承認

2. **権限変更**
   - 新owner: `admin` → `owner`
   - 旧owner: `owner` → `admin`

3. **監査ログ記録**
   - `org.ownership_transferred` を記録

### 実装例

```typescript
// apps/admin/app/org-settings/actions.ts
export async function transferOwnership(newOwnerId: string) {
  const { orgId, userId, role } = await getCurrentContext()

  // 現在のownerのみ実行可能
  if (role !== 'owner') {
    return { success: false, error: 'Forbidden' }
  }

  // 譲渡先が同一組織のメンバーか確認
  const { data: newOwnerProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', newOwnerId)
    .eq('org_id', orgId)
    .single()

  if (!newOwnerProfile) {
    return { success: false, error: 'Target user not found in this organization' }
  }

  const supabase = createClient()

  // トランザクション処理（Supabaseにはトランザクション機能がないため、順次実行）
  // 1. 新ownerを owner に昇格
  await supabase
    .from('profiles')
    .update({ role: 'owner' })
    .eq('id', newOwnerId)
    .eq('org_id', orgId)

  // 2. 自分を admin に降格
  await supabase
    .from('profiles')
    .update({ role: 'admin' })
    .eq('id', userId)
    .eq('org_id', orgId)

  // 監査ログ記録
  await logActivity(orgId, userId, 'org.ownership_transferred', {
    old_owner_id: userId,
    new_owner_id: newOwnerId,
  })

  return { success: true }
}
```

### 譲渡時の制約

- [ ] 新ownerは同一組織のメンバーであること
- [ ] 新ownerは `member` または `admin` であること（`ops` への譲渡は禁止）
- [ ] 組織には常に1人のownerが存在すること（owner不在は禁止）
- [ ] 旧ownerは自動的に `admin` に降格

---

## 6. 組織の完全削除（将来実装）

### 削除フロー

1. **廃止から30日経過後**
   - 自動的に削除対象としてマーク

2. **バックアップ取得**
   - 全データをS3/BigQueryにエクスポート

3. **物理削除**
   - `organizations` レコード削除
   - `profiles` レコード削除（CASCADE）
   - `activity_logs` レコード削除（CASCADE）

### 実装例（OPS権限）

```typescript
// apps/ops/app/orgs/[orgId]/delete/actions.ts
export async function deleteOrganization(orgId: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // OPS権限チェック
  const isOps = await isOpsUser()
  if (!isOps) {
    return { success: false, error: 'Forbidden' }
  }

  // ステータス確認（archived のみ削除可能）
  const { data: org } = await supabase
    .from('organizations')
    .select('status')
    .eq('id', orgId)
    .single()

  if (org.status !== 'archived') {
    return { success: false, error: 'Organization must be archived before deletion' }
  }

  // バックアップ取得（別途実装）
  await backupOrganizationData(orgId)

  // 組織を削除（CASCADE で profiles/activity_logs も削除される）
  const { error } = await supabase
    .from('organizations')
    .delete()
    .eq('id', orgId)

  if (error) {
    return { success: false, error: error.message }
  }

  // OPS用の監査ログに記録（組織が削除されるため、別テーブルに保存）
  await logOpsActivity(user!.id, 'org.deleted', {
    org_id: orgId,
  })

  return { success: true }
}
```

---

## チェックリスト

組織ライフサイクル管理の実装前に確認：

- [ ] 組織作成時にownerが必ず指定されている
- [ ] 凍結・解除のUI/APIが実装されている
- [ ] owner権限譲渡のUI/APIが実装されている
- [ ] 廃止前の確認ダイアログが実装されている（誤操作防止）
- [ ] 全操作で監査ログが記録されている
- [ ] RLSポリシーでステータスに応じたアクセス制御が実装されている
- [ ] 廃止組織のバックアップ戦略が決定されている

---

## 参考資料

- [Activity Logs Guide](./activity-logs.md)
- [Roles and Access Control](../spec/roles-and-access.md)
- [Member Management Specification](../spec/member-management.md)
