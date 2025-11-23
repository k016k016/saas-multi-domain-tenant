# 技術的負債と改善事項

このドキュメントは、コードベースの包括的なギャップ分析で発見された技術的負債と、将来的に対処すべき改善事項を記録します。

## 1. Server Action パターンの違反

### 現状の問題
いくつかのServer Actionで `redirect()` を直接使用している箇所があり、クライアント側の制御を奪っています。

### 影響箇所
- `/apps/admin/app/org-settings/actions.ts`: transferOwnership()
  - line 122: `redirect('/members')`
- `/apps/admin/app/switch-org/actions.ts`: switchActiveOrg()
  - line 60: `redirect(url.toString())`
- `/apps/www/app/actions.ts`: verifyUserEmail()
  - line 35: `redirect('/login')`
- `/apps/www/app/actions.ts`: sendSignInWithOTP()
  - line 58: `redirect('/verify-otp')`

### 正しいパターン
```typescript
// ❌ 悪い例：Server Action内でredirect
export async function myAction() {
  // ... 処理
  redirect('/path');
}

// ✅ 良い例：成功/エラーとnextUrlを返す
export async function myAction() {
  // ... 処理
  return {
    success: true,
    nextUrl: '/path'  // Open Redirect防止のため、サーバー側で生成
  };
}
```

### クライアント側の処理
```typescript
const result = await myAction();
if (result.success && result.nextUrl) {
  router.push(result.nextUrl);
}
```

### セキュリティ考慮事項
- **Open Redirect防止**: nextUrlは必ずサーバー側で生成し、ユーザー入力から直接構築しない
- **相対パス優先**: 可能な限り相対パスを使用（例: `/members`）
- **絶対URLが必要な場合**: 許可されたドメインのみに制限

## 2. Ops権限のサーバーサイド検証不足

### 現状の問題
Opsドメインの一部のアクションで、サーバーサイドの権限チェックが不足しています。

### 影響箇所
- `/apps/ops/app/orgs/new/actions.ts`: createOrganization()
  - isOpsUser() チェックなし
- `/apps/ops/app/orgs/[id]/actions.ts`: updateOrganization()
  - isOpsUser() チェックなし

### 必須の検証パターン
```typescript
// すべてのOpsアクションの先頭で必須
export async function opsAction() {
  const isOps = await isOpsUser();
  if (!isOps) {
    return { success: false, error: 'Unauthorized' };
  }

  // 実際の処理
}
```

### セキュリティ要件
- **middleware + Server Action の二重チェック**: middlewareでの制御に加えて、Server Action内でも必ず検証
- **Defense in Depth**: 複数レイヤーでの防御を実装

## 3. activity_logs の命名規則不統一

### 現状の問題
activity_logsのactionフィールドで使用される命名が統一されていません。

### 不統一な例
```typescript
// 異なる命名パターンが混在
'user_invited'           // snake_case
'member.invited'         // dot notation
'org.ownership_transferred'  // 混合
'payment_updated'        // snake_case
```

### 推奨される命名規則
```typescript
// dot notation で統一
'member.invited'
'member.removed'
'member.role_changed'
'org.created'
'org.frozen'
'org.unfrozen'
'org.archived'
'org.ownership_transferred'
'payment.updated'
'payment.failed'
```

### 命名ガイドライン
1. **リソース.アクション** の形式を使用
2. リソース名は単数形（member, org, payment）
3. アクションは過去分詞（invited, created, updated）
4. 複合語はアンダースコア（role_changed, ownership_transferred）

## 4. RLSセキュリティ考慮事項（論理削除）

### 将来的なリスク
論理削除（deleted_at カラム）を実装する場合、RLSポリシーの更新が必須です。

### 必要な対応
```sql
-- すべてのRLSポリシーに追加が必要
CREATE POLICY "users_can_view_own_data" ON profiles
FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  AND deleted_at IS NULL  -- 論理削除されたレコードを除外
);
```

### 影響を受けるテーブル
- profiles
- organizations
- activity_logs
- その他のすべてのテナントデータテーブル

### 実装時の注意点
1. **すべてのRLSポリシーを更新**: 1つでも漏れがあるとデータ漏洩のリスク
2. **インデックスの追加**: `(org_id, deleted_at)` の複合インデックス
3. **テスト必須**: 削除済みユーザーがデータにアクセスできないことを確認

## 5. エラーハンドリングの改善点

### 現状
- エラーメッセージが英語と日本語で混在
- エラーコードの体系化なし
- ユーザー向けメッセージと開発者向けログの区別が不明確

### 推奨される改善
```typescript
// エラーコードの体系化
enum ErrorCode {
  UNAUTHORIZED = 'AUTH_001',
  FORBIDDEN = 'AUTH_002',
  NOT_FOUND = 'DATA_001',
  VALIDATION_ERROR = 'VAL_001',
}

// 構造化されたエラー返却
return {
  success: false,
  error: {
    code: ErrorCode.UNAUTHORIZED,
    message: 'アクセス権限がありません',  // ユーザー向け
    details: { ... }  // デバッグ情報（本番では除外）
  }
};
```

## 6. 監査ログの拡充

### 不足している監査項目
- ログイン/ログアウトイベント
- パスワード変更
- 2FA設定の変更
- APIキーの生成/削除
- データエクスポート

### 推奨される追加フィールド
```typescript
interface ActivityLog {
  // 既存フィールド
  org_id: string;
  user_id: string;
  action: string;
  payload: any;

  // 追加推奨フィールド
  ip_address?: string;
  user_agent?: string;
  session_id?: string;
  request_id?: string;  // トレーサビリティ用
  severity?: 'info' | 'warning' | 'critical';
}
```

## 優先順位

1. **高 - セキュリティ関連**
   - Ops権限のサーバーサイド検証追加
   - Open Redirect防止（Server Action返却値の統一）

2. **中 - データ整合性**
   - activity_logs の命名規則統一
   - エラーハンドリングの体系化

3. **低 - 将来の拡張性**
   - 監査ログの拡充
   - 論理削除実装時のRLS更新（実装時まで保留）

## 実装時の注意事項

### 段階的な移行
1. 新規実装では正しいパターンを使用
2. 既存コードは優先順位に従って段階的に修正
3. 各修正後は必ずE2Eテストを実行

### テスト要件
- Server Action修正時：該当するE2Eテストを必ず実行
- RLS変更時：全Phase 4（Boundary & RLS）テストを実行
- 権限系の変更時：全Phase 2（Members & Audit）テストを実行

### ドキュメント更新
- このファイルは定期的に見直し、解決済み項目を削除
- 新たな技術的負債が発見された場合は追記
- 解決時はCHANGELOG.mdに記録

## 関連ドキュメント

- [Server Action パターン](./server-actions.md)
- [E2Eテストガイド](./e2e-testing.md)
- [セキュリティガイドライン](./security.md)