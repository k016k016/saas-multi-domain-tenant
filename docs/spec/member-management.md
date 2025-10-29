# ユーザー管理機能 (Member Management)

## 1. 機能概要

admin ドメイン (`apps/admin`) で、組織内のユーザーを管理する機能。

- ユーザー招待（メール送信）
- ユーザー一覧表示
- ロール変更（member ⇄ admin）
- ユーザー削除/無効化

admin / owner ロールのみアクセス可能。

## 2. 前提条件

- ユーザーは既にログイン済み（Supabase Session確立済み）
- アクティブな組織（org_id）を Cookie で保持している
- 実行ユーザーのロールは admin または owner
- member ロールはこの機能にアクセス不可（middleware で制御）

## 3. 正常フロー

### 3-1. ユーザー招待 (`inviteUser`)

1. admin/owner が `/members` ページで「招待」フォームを開く
2. メールアドレスと初期ロール（member / admin）を入力
3. Server Action `inviteUser(email, role)` を呼び出す
4. バックエンドで以下を実行:
   - 入力バリデーション（メールアドレス形式、ロール値）
   - 権限チェック（admin 以上のみ許可）
   - 重複チェック（同じメールアドレスが既に存在しないか）
   - Supabase Auth の `inviteUserByEmail()` で招待メール送信
   - `profiles` テーブルに仮ユーザーレコード作成（status: pending）
   - `activity_logs` に招待ログを記録
5. 成功時: `{ success: true, nextUrl: '/members' }` を返す
6. クライアント側で `router.refresh()` を実行して一覧を更新

### 3-2. ロール変更 (`changeUserRole`)

1. admin/owner が `/members` ページでユーザーのロール選択ボックスを変更
2. Server Action `changeUserRole(targetUserId, newRole)` を呼び出す
3. バックエンドで以下を実行:
   - 入力バリデーション（ユーザーID、ロール値）
   - 権限チェック（admin 以上のみ許可）
   - 対象ユーザーの現在のロールを取得
   - **owner のロール変更は禁止**（エラーを返す）
   - `profiles` テーブルの role カラムを更新
   - `activity_logs` に変更ログを記録（old_role → new_role）
4. 成功時: `{ success: true, nextUrl: '/members' }` を返す
5. クライアント側で `router.refresh()` を実行して一覧を更新

### 3-3. ユーザー削除 (`removeUser`)

1. admin/owner が `/members` ページでユーザーの「削除」ボタンをクリック
2. 確認ダイアログ表示（クライアント側）
3. Server Action `removeUser(targetUserId)` を呼び出す
4. バックエンドで以下を実行:
   - 入力バリデーション（ユーザーID）
   - 権限チェック（admin 以上のみ許可）
   - 対象ユーザーの現在のロールを取得
   - **owner の削除は禁止**（エラーを返す）
   - `profiles` テーブルのレコードを削除または無効化
     - 推奨: 論理削除（status: inactive, deleted_at, deleted_by）
     - 物理削除も可能だが監査要件に注意
   - `activity_logs` に削除ログを記録
5. 成功時: `{ success: true, nextUrl: '/members' }` を返す
6. クライアント側で `router.refresh()` を実行して一覧を更新

## 4. 権限制御

| ロール   | 招待 | ロール変更 | 削除 | 備考                         |
|---------|-----|----------|-----|------------------------------|
| member  | ❌  | ❌       | ❌  | middleware で admin 拒否      |
| admin   | ✅  | ✅       | ✅  | owner 以外の操作が可能         |
| owner   | ✅  | ✅       | ✅  | 全権限。自分自身の操作も可能   |
| ops     | ❌  | ❌       | ❌  | admin ドメインにアクセス不可   |

### 特殊ルール

- **owner のロール変更は禁止**: `changeUserRole()` でエラーを返す
- **owner の削除は禁止**: `removeUser()` でエラーを返す
- **owner 権限の移動（譲渡）は専用機能で実装**（将来実装）

## 5. データモデル

### profiles テーブル

| カラム名       | 型        | 説明                                |
|---------------|----------|-------------------------------------|
| user_id       | UUID     | Supabase Auth の user.id (主キー)   |
| org_id        | UUID     | 所属組織 (外部キー: organizations.id) |
| email         | TEXT     | ユーザーのメールアドレス              |
| role          | TEXT     | ロール（member/admin/owner/ops）     |
| status        | TEXT     | ユーザーステータス（active/pending/inactive） |
| invited_at    | TIMESTAMPTZ | 招待日時                         |
| invited_by    | UUID     | 招待したユーザーのID                 |
| deleted_at    | TIMESTAMPTZ | 削除日時（論理削除の場合）         |
| deleted_by    | UUID     | 削除したユーザーのID（論理削除の場合） |
| created_at    | TIMESTAMPTZ | レコード作成日時                  |
| updated_at    | TIMESTAMPTZ | レコード更新日時                  |

### activity_logs テーブル

| カラム名  | 型        | 説明                              |
|----------|----------|-----------------------------------|
| id       | UUID     | ログID (主キー)                    |
| user_id  | UUID     | 実行ユーザー（外部キー: profiles.user_id） |
| org_id   | UUID     | 組織ID（外部キー: organizations.id） |
| action   | TEXT     | アクション名                       |
| details  | JSONB    | 詳細情報（JSON形式）                |
| created_at | TIMESTAMPTZ | ログ記録日時                   |

### activity_logs.action 値

- `user_invited`: ユーザー招待
- `role_changed`: ロール変更
- `user_removed`: ユーザー削除/無効化

### activity_logs.details JSON 構造

**user_invited:**
```json
{
  "invited_email": "user@example.com",
  "invited_role": "member",
  "invited_user_id": "uuid-xxx",
  "timestamp": "2025-10-29T12:34:56.789Z"
}
```

**role_changed:**
```json
{
  "target_user_id": "uuid-xxx",
  "target_email": "user@example.com",
  "old_role": "member",
  "new_role": "admin",
  "timestamp": "2025-10-29T12:34:56.789Z"
}
```

**user_removed:**
```json
{
  "target_user_id": "uuid-xxx",
  "target_email": "user@example.com",
  "target_role": "member",
  "timestamp": "2025-10-29T12:34:56.789Z"
}
```

## 6. エラーハンドリング

### バリデーションエラー

- メールアドレス形式不正: `{ success: false, error: 'メールアドレスの形式が正しくありません' }`
- ロール値不正: `{ success: false, error: 'ロールはmemberまたはadminを指定してください' }`
- ユーザーID不正: `{ success: false, error: 'ユーザーIDが不正です' }`

### 権限エラー

- 権限不足: `{ success: false, error: 'この操作を行う権限がありません' }`
- owner ロール変更試行: `{ success: false, error: 'ownerのロールは変更できません。owner権限を譲渡する場合は専用の譲渡機能を使用してください。' }`
- owner 削除試行: `{ success: false, error: 'ownerは削除できません。owner権限を譲渡してから削除してください。' }`

### データベースエラー

- 招待メール送信失敗: `{ success: false, error: '招待メールの送信に失敗しました' }`
- ユーザーレコード作成失敗: `{ success: false, error: 'ユーザーレコードの作成に失敗しました' }`
- ロール更新失敗: `{ success: false, error: 'ロールの変更に失敗しました' }`
- ユーザー削除失敗: `{ success: false, error: 'ユーザーの削除に失敗しました' }`
- 対象ユーザー未発見: `{ success: false, error: '対象ユーザーが見つかりません' }`
- 重複メールアドレス: `{ success: false, error: 'このメールアドレスは既に登録されています' }`

### セッションエラー

- 認証セッション未確立: `{ success: false, error: '認証セッションが見つかりません' }`

## 7. UI/UX 設計

### `/members` ページ構成

1. **招待フォーム** (`invite-user-form.tsx`):
   - メールアドレス入力欄
   - ロール選択（member / admin）
   - 「招待」ボタン
   - エラーメッセージ表示領域

2. **ユーザー一覧テーブル** (`member-list.tsx`):
   - カラム: メールアドレス、ロール、ステータス、招待日時、アクション
   - ロール変更: セレクトボックス（owner はdisabled）
   - 削除ボタン（owner は非表示）
   - エラーメッセージ表示領域

### インタラクション

- Server Action 実行時にローディング状態を表示（`useTransition` 使用）
- 成功時: トースト通知 + `router.refresh()` で一覧更新
- エラー時: エラーメッセージ表示（フォーム下部またはトースト）
- owner のロール変更/削除ボタンは UI レベルで無効化（disabled / 非表示）

## 8. 禁止事項

### アーキテクチャ違反

- **Server Action 内で `redirect()` を使用しない**: 必ず `{ success, nextUrl }` を返す
- **middleware での認可チェックをスキップしない**: admin ドメインは admin/owner のみアクセス可能
- **RLS をバイパスしない**: Service Role Key 使用時も org_id スコープを厳守

### owner ルールの違反

- **owner のロール変更を許可しない**: `changeUserRole()` で必ずチェック
- **owner の削除を許可しない**: `removeUser()` で必ずチェック
- **owner 譲渡を通常のロール変更で実装しない**: 専用機能として別途実装

### 監査ログの省略

- **activity_logs への記録を省略しない**: 全ての admin 操作は必ず記録
- **ログ失敗を無視しない**: エラーログを出力し、将来的にはリトライ機能を検討

### テストのための緩和

- **「一旦 owner 削除を許可する」等の緩和は禁止**: 開発時も本番と同じ制約を守る
- **ダミーユーザーで owner ルールをスキップしない**: 全てのユーザーに同じルールを適用

## 9. 将来実装

### owner 譲渡機能

- 現在の owner が別ユーザーに owner 権限を譲渡
- 譲渡後、元 owner は admin にダウングレード
- activity_logs に `owner_transferred` アクションを記録

### 招待リンクの有効期限管理

- 招待メールのリンクに有効期限を設定（例: 7日間）
- 期限切れの場合は再招待を促す

### ユーザーのプロフィール編集

- ユーザー自身が自分のプロフィール（名前、アバター等）を編集
- admin/owner は他ユーザーのプロフィールを編集可能

### 一括招待機能

- CSV ファイルで複数ユーザーを一括招待
- バリデーション + 重複チェック + 招待メール一括送信

### 監査ログの UI 表示

- `/members/logs` ページで activity_logs を表示
- フィルタリング（アクション種別、日付範囲、対象ユーザー）
- エクスポート機能（CSV / JSON）

---

## 関連ファイル

- `apps/admin/app/members/page.tsx`: メインページ（Server Component）
- `apps/admin/app/members/invite-user-form.tsx`: 招待フォーム（Client Component）
- `apps/admin/app/members/member-list.tsx`: ユーザー一覧（Client Component）
- `apps/admin/app/members/actions.ts`: Server Actions（inviteUser / changeUserRole / removeUser）
- `apps/admin/middleware.ts`: admin ドメインのアクセス制御
- `packages/config/src/auth.ts`: getCurrentRole() / getCurrentOrg() / hasRole()
- `packages/db/src/index.ts`: createServerClient() / createBrowserClient()
- `infra/supabase/schema.sql`: profiles / activity_logs テーブル定義

## 関連仕様書

- [roles-and-access.md](./roles-and-access.md): ロール階層と権限定義
- [tenancy.md](./tenancy.md): マルチテナント設計と org_id スコープ
- [organization-switching.md](./organization-switching.md): 組織切替フロー
