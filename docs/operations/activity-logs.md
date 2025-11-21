# 監査ログ（Activity Logs）運用ガイド

このプロジェクトでは、重要な操作を `activity_logs` テーブルに記録し、監査・トラブルシューティング・コンプライアンスに活用します。

---

## 目的

1. **監査**: 誰が、いつ、何をしたかを追跡
2. **トラブルシューティング**: 問題発生時の原因特定
3. **コンプライアンス**: 規制対応（GDPR、SOC2など）
4. **セキュリティ**: 不正操作の検出

---

## 記録対象の操作

### 必須記録操作

以下の操作は**必ず** `activity_logs` に記録します：

#### 1. 組織コンテキスト変更
- **操作**: 組織切り替え
- **記録タイミング**: 切り替え成功時
- **実装場所**: `apps/app/app/switch-org/actions.ts`

#### 2. メンバー管理（admin権限）
- **操作**:
  - メンバー招待
  - ロール変更（member ↔ admin）
  - メンバー無効化
  - メンバー削除
- **記録タイミング**: 操作成功時
- **実装場所**: `apps/admin/app/members/actions.ts`

#### 3. 組織設定変更（owner権限）
- **操作**:
  - 支払い情報変更
  - 組織凍結・廃止
  - owner権限譲渡
  - admin権限付け替え
- **記録タイミング**: 操作成功時
- **実装場所**: `apps/admin/app/org-settings/actions.ts`（将来実装）

#### 4. OPS操作（ops権限）
- **操作**:
  - 組織の強制凍結
  - 組織の新規作成
  - クロスオーガニゼーション閲覧
- **記録タイミング**: 操作実行時
- **実装場所**: `apps/ops/app/orgs/actions.ts`

---

## データ構造

### activity_logs テーブル

```sql
CREATE TABLE activity_logs (
  id BIGSERIAL PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  action TEXT NOT NULL,           -- 操作種別
  payload JSONB,                  -- 操作詳細
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_activity_logs_org_id ON activity_logs(org_id);
CREATE INDEX idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_action ON activity_logs(action);
CREATE INDEX idx_activity_logs_created_at ON activity_logs(created_at DESC);
```

### フィールド説明

| フィールド | 型 | 説明 |
|----------|-----|------|
| `id` | BIGSERIAL | ログID（自動採番） |
| `org_id` | UUID | 対象組織ID |
| `user_id` | UUID | 操作実行者のユーザーID |
| `action` | TEXT | 操作種別（`org.switched`, `member.invited`など） |
| `payload` | JSONB | 操作の詳細情報（柔軟なJSON構造） |
| `created_at` | TIMESTAMPTZ | 操作実行日時 |

---

## 実装パターン

### 基本的な記録方法

```typescript
import { createClient } from '@/lib/supabase/server'

export async function logActivity(
  orgId: string,
  userId: string,
  action: string,
  payload: Record<string, unknown>
) {
  const supabase = createClient()

  const { error } = await supabase
    .from('activity_logs')
    .insert({
      org_id: orgId,
      user_id: userId,
      action,
      payload,
    })

  if (error) {
    console.error('Failed to log activity:', error)
    // エラーは握りつぶす（ログ失敗でメイン処理を止めない）
  }
}
```

### 操作別の実装例

#### 1. 組織切り替え

```typescript
// apps/app/app/switch-org/actions.ts
export async function switchOrg(targetOrgId: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // 組織切り替え処理
  const { error } = await supabase
    .from('user_org_context')
    .update({ current_org_id: targetOrgId })
    .eq('user_id', user!.id)

  if (error) {
    return { success: false, error: error.message }
  }

  // 監査ログ記録
  await logActivity(targetOrgId, user!.id, 'org.switched', {
    from_org_id: previousOrgId,
    to_org_id: targetOrgId,
  })

  return { success: true }
}
```

#### 2. メンバー招待

```typescript
// apps/admin/app/members/actions.ts
export async function inviteUser(email: string, role: string) {
  const { orgId, userId } = await getCurrentContext()

  // 招待処理
  const { data: newUser, error } = await supabase.auth.admin.inviteUserByEmail(email)
  if (error) return { success: false, error: error.message }

  // プロフィール作成
  await supabase.from('profiles').insert({
    id: newUser.user.id,
    org_id: orgId,
    role,
  })

  // 監査ログ記録
  await logActivity(orgId, userId, 'member.invited', {
    invited_email: email,
    assigned_role: role,
    invited_user_id: newUser.user.id,
  })

  return { success: true }
}
```

#### 3. ロール変更

```typescript
// apps/admin/app/members/actions.ts
export async function changeUserRole(targetUserId: string, newRole: string) {
  const { orgId, userId } = await getCurrentContext()

  // 現在のロールを取得
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', targetUserId)
    .eq('org_id', orgId)
    .single()

  const oldRole = profile?.role

  // ロール変更
  await supabase
    .from('profiles')
    .update({ role: newRole })
    .eq('id', targetUserId)
    .eq('org_id', orgId)

  // 監査ログ記録
  await logActivity(orgId, userId, 'member.role_changed', {
    target_user_id: targetUserId,
    old_role: oldRole,
    new_role: newRole,
  })

  return { success: true }
}
```

#### 4. owner権限譲渡

```typescript
// apps/admin/app/org-settings/actions.ts
export async function transferOwnership(newOwnerId: string) {
  const { orgId, userId, role } = await getCurrentContext()

  // 現在のownerのみ実行可能
  if (role !== 'owner') {
    return { success: false, error: 'Forbidden' }
  }

  // トランザクション処理
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

---

## ログの閲覧

### 基本的なクエリ

#### 特定組織の最新ログ

```sql
SELECT
  al.action,
  al.payload,
  al.created_at,
  u.email AS user_email
FROM activity_logs al
JOIN auth.users u ON al.user_id = u.id
WHERE al.org_id = '<org-id>'
ORDER BY al.created_at DESC
LIMIT 100;
```

#### 特定ユーザーの操作履歴

```sql
SELECT
  al.action,
  al.payload,
  al.created_at,
  o.name AS organization_name
FROM activity_logs al
JOIN organizations o ON al.org_id = o.id
WHERE al.user_id = '<user-id>'
ORDER BY al.created_at DESC
LIMIT 100;
```

#### 特定操作種別の検索

```sql
SELECT *
FROM activity_logs
WHERE action = 'member.role_changed'
  AND created_at >= NOW() - INTERVAL '30 days'
ORDER BY created_at DESC;
```

#### JSONB payloadの検索

```sql
-- owner権限譲渡のログを検索
SELECT *
FROM activity_logs
WHERE action = 'org.ownership_transferred'
  AND payload->>'new_owner_id' = '<user-id>';

-- ロール変更でadminに昇格した履歴
SELECT *
FROM activity_logs
WHERE action = 'member.role_changed'
  AND payload->>'new_role' = 'admin';
```

### UI実装（将来追加予定）

`apps/admin/app/audit-logs/page.tsx` で以下の機能を提供：

- [ ] 組織内の全ログ一覧
- [ ] フィルタリング（操作種別、ユーザー、期間）
- [ ] CSVエクスポート
- [ ] ページネーション

---

## 運用ベストプラクティス

### 1. ログ保持期間

**推奨**: 最低90日間、コンプライアンス要件により1年〜7年

```sql
-- 90日以前のログを削除（定期実行）
DELETE FROM activity_logs
WHERE created_at < NOW() - INTERVAL '90 days';
```

**注意**: 削除前にアーカイブ（S3、BigQueryなど）への移行を推奨

### 2. パフォーマンス

- インデックス最適化（`org_id`, `user_id`, `action`, `created_at`）
- 古いログのパーティショニング（PostgreSQLのパーティションテーブル）
- 頻繁な検索はマテリアライズドビューで高速化

### 3. セキュリティ

- RLSポリシーで組織内のログのみ閲覧可能に制限
- OPS権限は全組織のログを横断閲覧可能（監査目的）
- `payload` に秘密情報（パスワード、トークン）を含めない

### 4. 通知

重要な操作はログ記録だけでなくリアルタイム通知も検討：

- owner権限譲渡 → メール通知
- 組織凍結 → Slack通知
- 大量のメンバー削除 → アラート

---

## トラブルシューティング

### ログが記録されない

**原因1**: RLSポリシーで挿入が拒否されている

**解決策**: `activity_logs` のINSERTポリシーを確認
```sql
-- 全認証ユーザーが挿入可能にする
CREATE POLICY "Allow authenticated users to insert logs"
  ON activity_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
```

**原因2**: トランザクションがロールバックされている

**解決策**: ログ記録をトランザクション外で実行（別コネクション）

### パフォーマンス低下

**原因**: ログテーブルが肥大化している

**解決策**:
1. 古いログをアーカイブして削除
2. パーティショニングを導入
3. インデックスを最適化

---

## チェックリスト

監査ログ運用開始前に以下を確認：

- [ ] `activity_logs` テーブルが作成されている
- [ ] 必要なインデックスが設定されている
- [ ] RLSポリシーが設定されている（組織内閲覧制限）
- [ ] 重要操作でログ記録が実装されている
- [ ] ログ保持期間が決定されている
- [ ] アーカイブ戦略が決定されている（S3、BigQueryなど）
- [ ] ログ閲覧UIが実装されている（admin画面）
- [ ] 通知設定が完了している（owner権限譲渡など）

---

## 参考資料

- [Schema Definition](../../infra/supabase/migrations/20251030121106_initial_schema.sql)
- [Member Management Actions](../../apps/admin/app/members/actions.ts)
- [Organization Switching Actions](../../apps/app/app/switch-org/actions.ts)
