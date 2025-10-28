# E2Eテストユーザー設計

このドキュメントには、E2Eテストで使用する全てのテストユーザーの定義が記載されています。

---

## 📊 ユーザーマトリクス

| ユーザーID | メール | 組織数 | 組織1権限 | 組織2権限 | 主な用途 |
|-----------|--------|-------|----------|----------|----------|
| `ops@example.com` | ops@example.com | 1 | ops | - | 運用機能テスト、IP制限テスト |
| `owner@example.com` | owner@example.com | 1 | owner | - | 組織オーナー機能全般 |
| `admin@example.com` | admin@example.com | 1 | admin | - | 管理者機能（メンバー招待等） |
| `member@example.com` | member@example.com | 1 | member | - | 一般メンバー機能、権限制限テスト |
| `multiorg@example.com` | multiorg@example.com | 2 | owner | admin | 組織切り替え、複数組織シナリオ |

---

## 🔐 認証情報

**全ユーザー共通パスワード**: `password123`

**定数**: `TEST_PASSWORD`（`e2e/global-setup.ts`）

⚠️ **セキュリティ警告**: テスト専用のパスワードです。本番環境では絶対に使用しないでください。

---

## 📋 組織情報

| 組織名 | slug | オーナー | メンバー | 用途 |
|-------|------|---------|---------|------|
| Owner Organization | owner-org | owner@ | - | 基本的な組織機能テスト |
| Admin Organization | admin-org | admin@ | - | 管理者機能テスト |
| Member Organization | member-org | (別途) | member@ | メンバー権限テスト |
| MultiOrg Owner Organization | multiorg-owner | multiorg@ | - | 組織切り替えテスト1 |
| MultiOrg Admin Organization | multiorg-admin | (別途) | multiorg@(admin) | 組織切り替えテスト2 |

---

## 🎯 テストシナリオ別の推奨ユーザー

### 認証フロー

- **サインアップ**: 動的ユーザー (`test${timestamp}@example.com`)
- **ログイン**: `owner@example.com`
- **パスワードリセット**: 動的ユーザー
- **OAuth**: 動的ユーザー

### 組織機能

- **組織作成**: `owner@example.com`
- **メンバー招待**: `admin@example.com`（admin権限が必要）
- **組織切り替え**: `multiorg@example.com`
- **権限チェック**: `member@example.com`（制限された権限）

### Wiki機能

- **ページ作成**: `owner@example.com` または `member@example.com`
- **ページ編集**: `member@example.com`（全メンバー編集可能を確認）
- **ページ削除**: `owner@example.com`（削除権限を確認）

### 運用機能

- **OPSダッシュボード**: `ops@example.com`
- **IP制限**: `ops@example.com`

---

## 🔄 セットアップ

E2Eテストユーザーは`e2e/global-setup.ts`で自動作成されます。

### 使用例

```typescript
import { loginAsOwner, loginAsAdmin, loginAsMember, loginAsMultiOrg } from './helpers'

test('管理者はメンバーを招待できる', async ({ page }) => {
  await loginAsAdmin(page)

  await page.goto(`${DOMAINS.ADMIN}/settings/members`)
  // ... テスト
})

test('メンバーは組織設定を変更できない', async ({ page }) => {
  await loginAsMember(page)

  await page.goto(`${DOMAINS.ADMIN}/settings/organization`)
  // ... 権限エラーを確認
})
```

---

## 📝 ユーザー追加時のルール

新しいテストユーザーを追加する場合：

1. **このドキュメントのマトリクスを更新**
2. **`e2e/global-setup.ts`にユーザー作成コードを追加**
3. **`e2e/helpers.ts`にログインヘルパーを追加**
4. **用途と想定シナリオを明記**

### テンプレート

```markdown
| `new@example.com` | new@example.com | 1 | owner | - | 【用途を記載】 |
```

```typescript
// e2e/global-setup.ts
const newUser = await createTestUser('new@example.com', TEST_PASSWORD, {
  companyName: 'New Organization',
  contactName: 'New User',
})
const newOrg = await createTestOrganization(newUser.id, 'New Organization', 'new-org')
```

```typescript
// e2e/helpers.ts
export async function loginAsNew(page: Page) {
  return loginAs(page, 'new@example.com', TEST_PASSWORD)
}
```

---

## ⚠️ 注意事項

### セキュリティ

- **本番環境では使用禁止**: これらのユーザーはテスト専用
- **パスワードは固定**: セキュリティリスクがあるため、本番DBには絶対に作成しない
- **定期クリーンアップ**: `e2e/helpers/test-setup.ts`の`cleanupTestData()`で削除

### 冪等性

- グローバルセットアップは**冪等**である必要がある
- 既存のテストユーザーがいる場合は削除してから作成
- 組織名の重複を避ける

### ログイン状態の保存

- `e2e/global-setup.ts`で各ユーザーの`storageState`を生成
- テスト開始時に`use`でログイン状態を復元
- これにより、毎回ログインフォームを操作する必要がない

---

## 📊 統計情報

- **総ユーザー数**: 5ユーザー
- **総組織数**: 5組織
- **権限の種類**: ops, owner, admin, member

---

このテストデータ設計により、**体系的で保守しやすいE2Eテスト**を実現できます。
