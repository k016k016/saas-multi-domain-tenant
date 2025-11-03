# E2Eテストユーザー設計

このドキュメントには、E2Eテストで使用する全てのテストユーザーの定義が記載されています。

---

## 📊 ユーザーマトリクス

**実際のseed済みユーザー**（`scripts/seed-test-user.ts` で作成）:

| メールアドレス | 組織1 (Test Organization) | 組織2 (Test Organization Beta) | 主な用途 |
|--------------|--------------------------|-------------------------------|----------|
| `member1@example.com` | member | admin | ロール変化パターン（member→admin）、組織切替 |
| `admin1@example.com` | admin | member | ロール変化パターン（admin→member）、権限低下テスト |
| `owner1@example.com` | owner | - | 組織オーナー機能全般（支払い、組織設定等） |
| `owner2@example.com` | - | owner | 組織2のオーナー（仕様遵守: 各組織に必ず1人のowner） |

**組織情報**:
- **組織1**:
  - ID: `00000000-0000-0000-0000-000000000001`
  - 名前: `Test Organization`
  - プラン: `pro`
- **組織2**:
  - ID: `00000000-0000-0000-0000-000000000002`
  - 名前: `Test Organization Beta`
  - プラン: `business`

---

## 🔐 認証情報

**全ユーザー共通パスワード**: 環境変数 `E2E_TEST_PASSWORD`

**テストコードでの使用方法**:
```typescript
const PASSWORD = process.env.E2E_TEST_PASSWORD!;
```

⚠️ **セキュリティ警告**: テスト専用のパスワードです。本番環境では絶対に使用しないでください。

---

## 🎯 テストシナリオ別の推奨ユーザー

### 認証フロー

- **ログイン**: `owner1@example.com` または `admin1@example.com`
- **サインアップ**: 動的ユーザー（`e2e+${Date.now()}@example.com`）

### 組織機能

- **メンバー招待**: `admin1@example.com` または `owner1@example.com`
- **ロール変更**: `admin1@example.com` または `owner1@example.com`
- **権限チェック**: `member1@example.com`（制限された権限）

### 管理者機能（adminドメイン）

- **メンバー管理**: `admin1@example.com`（admin権限で十分）
- **組織設定変更**: `owner1@example.com`（owner権限が必要）
- **監査ログ閲覧**: `admin1@example.com` または `owner1@example.com`

### 境界テスト（アクセス制御）

- **member → admin domain**: `member1@example.com`（404を確認）
- **admin → admin domain**: `admin1@example.com`（アクセス可能を確認）
- **owner → admin domain**: `owner1@example.com`（アクセス可能を確認）

---

## 🔄 セットアップ

E2Eテストユーザーは `scripts/seed-test-user.ts` で作成されます。

### セットアップコマンド

```bash
# .env.test に環境変数を設定
pnpm setup:e2e
```

このコマンドは以下を実行します：
1. テスト用組織の作成/更新
2. 3つのテストユーザー（member1, admin1, owner1）の作成/更新
3. profilesテーブルへのロール情報の登録

### テストコードでの使用例

```typescript
import { test, expect } from '@playwright/test';
import { DOMAINS } from '../../helpers/domains';
import { uiLogin } from '../../helpers/auth';

const ADMIN = { email: 'admin1@example.com' };
const MEMBER = { email: 'member1@example.com' };
const PASSWORD = process.env.E2E_TEST_PASSWORD!;

test('管理者はメンバーを招待できる', async ({ page }) => {
  await uiLogin(page, ADMIN.email, PASSWORD);
  await page.goto(`${DOMAINS.ADMIN}/members`);

  // 招待フォームの表示確認
  await expect(page.locator('input#email')).toBeVisible();
});

test('メンバーは管理画面にアクセスできない', async ({ page }) => {
  await uiLogin(page, MEMBER.email, PASSWORD);
  const res = await page.goto(`${DOMAINS.ADMIN}/members`);

  // 404を確認
  expect(res?.status()).toBe(404);
});
```

---

## 📝 ユーザー追加時のルール

新しいテストユーザーを追加する場合：

1. **このドキュメントのマトリクスを更新**
2. **`scripts/seed-test-user.ts` の `TEST_USERS` 配列にユーザーを追加**
3. **用途と想定シナリオを明記**

### テンプレート

```markdown
| `new1@example.com` | Test Organization | role_name | 【用途を記載】 |
```

```typescript
// scripts/seed-test-user.ts
const TEST_USERS = [
  { email: 'member1@example.com', role: 'member' },
  { email: 'admin1@example.com', role: 'admin' },
  { email: 'owner1@example.com', role: 'owner' },
  { email: 'new1@example.com', role: 'role_name' }, // 追加
] as const;
```

---

## ⚠️ 注意事項

### セキュリティ

- **本番環境では使用禁止**: これらのユーザーはテスト専用
- **パスワードは環境変数管理**: `E2E_TEST_PASSWORD` で管理し、コードに直接記載しない
- **本番DBには作成しない**: テスト環境専用

### 冪等性

- `scripts/seed-test-user.ts` は**冪等**な設計
- 既存のテストユーザーがいる場合はパスワードを更新
- 既存のprofileレコードは削除してから再挿入

### データの永続性

- **seed済みユーザーは削除しない**: E2Eテストから既存ユーザーを削除しない
- **ロールの変更は禁止**: テスト中にロールを付け替えない
- **新規ユーザー作成時は一意メールを使用**: `e2e+${Date.now()}@example.com`

---

## 📊 統計情報

- **総ユーザー数**: 3ユーザー（member1, admin1, owner1）
- **総組織数**: 1組織（Test Organization）
- **権限の種類**: member, admin, owner

---

## 関連ドキュメント

- [テストデータ設計](./README.md)
- [E2Eテストパターン](../patterns/e2e-testing.md)
- [E2Eテストテンプレート](../patterns/e2e-test-templates.md)
