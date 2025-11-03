# E2Eテストファイル構造テンプレート

本ドキュメントでは、既存のE2Eテストで統一されているファイル構造とパターンを文書化します。

---

## テストファイルの基本構造

### 完全なテンプレート

```typescript
import { test, expect } from '@playwright/test';
import { DOMAINS } from '../../helpers/domains';
import { uiLogin } from '../../helpers/auth';

const ADMIN = { email: 'admin1@example.com' };
const OWNER = { email: 'owner1@example.com' };
const MEMBER = { email: 'member1@example.com' };
const PASSWORD = process.env.E2E_TEST_PASSWORD!;

test.describe('機能名または境界の説明', () => {
  test('テストケース名', async ({ page }) => {
    // テストロジック
  });
});
```

---

## 構造の詳細ルール

### 1. import順序

以下の順序で統一します：

```typescript
// 1. Playwrightライブラリ
import { test, expect } from '@playwright/test';

// 2. ヘルパー関数（DOMAINS → auth の順）
import { DOMAINS } from '../../helpers/domains';
import { uiLogin } from '../../helpers/auth';

// 3. その他のimportがある場合はここに追加
```

### 2. ユーザー定義の配置

importの直後に、以下の順序でユーザー定義を配置します：

```typescript
const ADMIN = { email: 'admin1@example.com' };
const OWNER = { email: 'owner1@example.com' };
const MEMBER = { email: 'member1@example.com' };
const PASSWORD = process.env.E2E_TEST_PASSWORD!;
```

**重要な規則**:
- ✅ 使用するユーザーのみ定義する（不要なユーザーは定義しない）
- ✅ ロールの順序: ADMIN → OWNER → MEMBER
- ✅ PASSWORD は必ず `process.env.E2E_TEST_PASSWORD!` で取得

### 3. test.describe の使い方

```typescript
test.describe('機能名または境界の説明', () => {
  // 複数のテストケースをグルーピング
  test('テストケース1', async ({ page }) => { ... });
  test('テストケース2', async ({ page }) => { ... });
});
```

**推奨事項**:
- ✅ 1ファイル1機能または1境界のテスト
- ✅ test.describe のネストは基本的に1階層のみ
- ✅ テスト名は具体的で分かりやすい日本語

---

## 権限テストの標準パターン

### パターン1: アクセス可能（200 OK + UI確認）

```typescript
test('admin → ページにアクセス可能', async ({ page }) => {
  await uiLogin(page, ADMIN.email, PASSWORD);
  await page.goto(`${DOMAINS.ADMIN}/members`);

  await expect(page.getByRole('heading', { name: /members|メンバー/i })).toBeVisible();
  await expect(page.getByRole('table')).toBeVisible();
});
```

**ポイント**:
- ✅ ログイン → ページ遷移 → UI要素確認の3ステップ
- ✅ 見出しとメインコンテンツ（テーブルなど）の両方を確認

### パターン2: アクセス拒否（404）

```typescript
test('member → ページにアクセス不可（404）', async ({ page }) => {
  await uiLogin(page, MEMBER.email, PASSWORD);
  const res = await page.goto(`${DOMAINS.ADMIN}/members`);

  expect(res?.status()).toBe(404);
});
```

**ポイント**:
- ✅ `res` 変数でレスポンスを受け取る
- ✅ HTTPステータスコードで検証（404）
- ✅ UI確認は不要（エラーページなので）

### パターン3: 未認証リダイレクト

```typescript
test('未認証 → www/login にリダイレクト', async ({ page }) => {
  await page.goto(`${DOMAINS.ADMIN}/members`);

  await expect(page).toHaveURL(new RegExp(`${DOMAINS.WWW}/login`));
});
```

**ポイント**:
- ✅ `uiLogin` を呼ばない
- ✅ URLの正規表現マッチングで検証

---

## フォーム操作のパターン

### 基本的な入力 + 送信

```typescript
test('admin → ユーザーを招待できる', async ({ page }) => {
  await uiLogin(page, ADMIN.email, PASSWORD);
  await page.goto(`${DOMAINS.ADMIN}/members`);

  // 入力
  await page.locator('input#email').fill('user@example.com');
  await page.locator('select#role').selectOption('member');

  // 送信
  await page.getByRole('button', { name: /招待する/i }).click();

  // 結果確認
  await expect(page.getByText(/招待メールを送信しました/i)).toBeVisible();
});
```

### 一意メールアドレスの生成

既存ユーザーとの衝突を避けるため、タイムスタンプ付きメールアドレスを使用します：

```typescript
const timestamp = Date.now();
const uniqueEmail = `e2e+${timestamp}@example.com`;

await page.locator('input#email').fill(uniqueEmail);
```

**重要**:
- ✅ `Date.now()` でミリ秒タイムスタンプを使用
- ✅ フォーマット: `e2e+${timestamp}@example.com`

---

## セレクタのパターン

### 推奨セレクタの優先順位

1. **getByRole（最優先）**
   ```typescript
   page.getByRole('heading', { name: /監査ログ/i })
   page.getByRole('button', { name: /保存/i })
   page.getByRole('table')
   ```

2. **IDセレクタ（フォーム要素）**
   ```typescript
   page.locator('input#email')
   page.locator('select#role')
   ```

3. **getByText（表示確認）**
   ```typescript
   page.getByText(/招待メールを送信しました/i)
   page.getByText(/role:\s*admin/i)
   ```

4. **構造セレクタ（最終手段）**
   ```typescript
   page.locator('table select').first()
   page.getByRole('button', { name: /削除/i }).first()
   ```

**禁止パターン**:
- ❌ CSSクラスセレクタ（`.btn-primary` など）
- ❌ data-testid の使用
- ❌ nth-child（`tr:nth-child(2)` など）

---

## 待機とアサーションのパターン

### 自動待機を活用する

```typescript
// ✅ 良い例: toBeVisible() は自動的に待機する
await expect(page.getByRole('heading', { name: /監査ログ/i })).toBeVisible();

// ✅ 良い例: toHaveURL() も自動的に待機する
await expect(page).toHaveURL(/action=org_switched/);

// ❌ 悪い例: 手動waitは避ける
await page.waitForTimeout(1000); // アンチパターン
```

### HTTPステータスコードの確認

```typescript
const res = await page.goto(`${DOMAINS.ADMIN}/members`);
expect(res?.status()).toBe(404);
```

---

## 実例: 完全なテストファイル

```typescript
import { test, expect } from '@playwright/test';
import { DOMAINS } from '../../helpers/domains';
import { uiLogin } from '../../helpers/auth';

const ADMIN = { email: 'admin1@example.com' };
const MEMBER = { email: 'member1@example.com' };
const PASSWORD = process.env.E2E_TEST_PASSWORD!;

test.describe('admin/members アクセス制御', () => {
  test('admin → メンバー一覧にアクセス可能', async ({ page }) => {
    await uiLogin(page, ADMIN.email, PASSWORD);
    await page.goto(`${DOMAINS.ADMIN}/members`);

    await expect(page.getByRole('heading', { name: /members|メンバー/i })).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();
  });

  test('member → メンバー一覧にアクセス不可（404）', async ({ page }) => {
    await uiLogin(page, MEMBER.email, PASSWORD);
    const res = await page.goto(`${DOMAINS.ADMIN}/members`);

    expect(res?.status()).toBe(404);
  });

  test('未認証 → www/login にリダイレクト', async ({ page }) => {
    await page.goto(`${DOMAINS.ADMIN}/members`);

    await expect(page).toHaveURL(new RegExp(`${DOMAINS.WWW}/login`));
  });
});
```

---

## チェックリスト

新しいE2Eテストを作成する際は、以下を確認してください：

- [ ] import順序は正しいか（Playwright → helpers）
- [ ] ユーザー定義は冒頭に配置されているか
- [ ] PASSWORD は `process.env.E2E_TEST_PASSWORD!` を使用しているか
- [ ] test.describe で機能をグルーピングしているか
- [ ] 権限テストは3パターン（アクセス可/不可/未認証）を網羅しているか
- [ ] セレクタは推奨パターンに従っているか（getByRole優先）
- [ ] 一意メールアドレスは `Date.now()` を使用しているか
- [ ] 手動waitForTimeout を使用していないか

---

## 関連ドキュメント

- [E2Eテスト設計パターン](./e2e-testing.md)
- [テストデータ設計](../test-data/README.md)
- [E2Eテストチェックリスト](../checklists/e2e-test-checklist.md)
