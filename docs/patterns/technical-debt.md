# 技術的負債と改善事項

このドキュメントは、コードベースの包括的なギャップ分析で発見された技術的負債と、将来的に対処すべき改善事項を記録します。

## 1. RLSセキュリティ考慮事項（論理削除）

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

## 2. エラーハンドリングの改善点

### 完了済み
- ✅ エラーメッセージの英語と日本語混在を解消（英語プレフィックス削除）
- ✅ ActionResult型定義の統一（@repo/configからインポート）

### 将来実装
以下は大規模な変更が必要なため、必要性が明確になった時点で実装：

- エラーコードの体系化（enum ErrorCode の導入）
- ユーザー向けメッセージと開発者向けログの分離

### 推奨される実装例（将来）
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

**注意**: この実装には全Server Actions + 全クライアント側処理 + 全E2Eテストの修正が必要

## 3. 監査ログの拡充

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

1. **中 - データ整合性**
   - エラーハンドリングの体系化

2. **低 - 将来の拡張性**
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