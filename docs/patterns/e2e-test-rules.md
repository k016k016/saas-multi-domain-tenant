# E2Eテスト追加ルール

このドキュメントは、E2Eテストを追加・修正する際のルールとガイドラインをまとめたものです。

---

## 1. フェーズ分離の原則

テストは5つのフェーズに分離されています：

### Phase 1 (p1-baseline): 基盤テスト
**配置場所**: `e2e/tests/p1-baseline/`

**目的**: 基本的なインフラストラクチャが正しく動作するかを検証

**含まれるテスト**:
- 認証（ログイン/ログアウト）
- ドメイン境界制御（未認証リダイレクト、ドメイン間のアクセス制御）
- ロール境界制御（member/admin/owner の基本的なアクセス制限）
- orgサブドメイン（例: `acme.app.local.test`）を跨いだアクセス制御
- 基本的なエラーページ（404, /unauthorized）
- Cookie/Session の基本動作

**実行コマンド**:
```bash
pnpm test:e2e:p1
pnpm test:e2e:p1:ui
```

**ブラウザ**: chromium（UIモードはデバッグ用途）

### Phase 2 (p2-members-audit): 新機能テスト
**配置場所**: `e2e/tests/p2-members-audit/`

**目的**: メンバー管理・監査ログなど、Phase 1に**依存する**新機能を検証

**含まれるテスト**:
- メンバー管理のCRUD操作
- ロール変更機能
- 監査ログの記録・閲覧・フィルタリング
- フォームバリデーション（招待フォームなど）
- 複雑な権限制御（ownerの削除不可など）

**実行コマンド**:
```bash
pnpm test:e2e:p2
pnpm test:e2e:p2:ui
```

**ブラウザ**: chromium

### Phase 3 (p3-ops-orgs): OPS & 組織ライフサイクル
**配置場所**: `e2e/tests/p3-ops-orgs/`

**目的**: OPS向け機能（組織CRUD、ライフサイクル、OPSユーザーの権限）を検証

**含まれるテスト**:
- OPSコンソールへのアクセス制御
- 組織作成・編集・削除・凍結/解除
- OPSユーザーの多組織所属と横断操作の制御

**実行コマンド**:
```bash
pnpm test:e2e:p3
```

### Phase 4 (p4-boundary): 境界・RLS・クロスドメイン
**配置場所**: `e2e/tests/p4-boundary/`

**目的**: ドメイン間アクセス、RLS境界、マルチタブ挙動など、境界系のリグレッションを検証

**含まれるテスト**:
- ロール別のドメインアクセス
- RLSベースのデータ越境防止
- マルチタブ・マルチホストでのコンテキスト独立性

**実行コマンド**:
```bash
pnpm test:e2e:p4
```

### Phase 5 (p5-security): セキュリティ / 意地悪テスト
**配置場所**: `e2e/tests/p5-security/`

**目的**: CSRF/直叩き、ホスト・ヘッダー偽装、RLSバイパスなど、意地悪ケースをまとめて検証

**含まれるテスト**:
- `x-org-slug` ヘッダー注入
- サブドメイン偽装アクセス
- Supabase REST への不正INSERT/RLSバイパス
- 追加予定のOPS cookie盗用や凍結中orgアクセス遮断

**実行コマンド**:
```bash
pnpm test:e2e:p5
```

---

## 2. テスト追加ルール

### 新機能を追加するときの判断基準

#### Phase 1に追加すべきケース
- 新しい**ドメイン**を追加した（例: billing.local.test）
- 新しい**ロール**を追加した（例: viewer）
- **認証フロー**を変更した（例: MFA追加）
- **middlewareの振る舞い**を変更した
- **基本的なエラーハンドリング**を変更した

#### Phase 2に追加すべきケース
- **メンバー管理機能**に関連する機能を追加した
- **監査ログ機能**に関連する機能を追加した
- **フォーム**を使った新機能を追加した
- Phase 1の機能に**依存する**新機能を追加した

#### 新しいPhaseを作成すべきケース
- Phase 2と**依存関係がない**大きな新機能群を追加する場合
- 例: Phase 3 (p3-billing): 請求管理機能群
- 例: Phase 4 (p4-reports): レポート機能群

**ルール**: 新しいPhaseを作成する場合は、`playwright.config.ts`と`package.json`を更新すること

---

## 3. テストの分類体系

### 3-1. 認証テスト (Authentication Tests)
**目的**: 未認証ユーザーが保護されたページにアクセスできないことを確認

**パターン**:
```typescript
test('未認証 → 保護されたページにアクセス → ログインページにリダイレクト', async ({ page }) => {
  await page.goto(`${DOMAINS.ADMIN}/members`);
  await expect(page).toHaveURL(new RegExp(`${DOMAINS.WWW}/login`));
});
```

**配置**: Phase 1

### 3-2. 認可テスト (Authorization Tests)
**目的**: 権限のないユーザーが制限されたリソースにアクセスできないことを確認

**パターン（ドメイン境界）**:
```typescript
test('member → adminドメインにアクセス → 404', async ({ page }) => {
  await uiLogin(page, MEMBER.email, PASSWORD);
  const res = await page.goto(`${DOMAINS.ADMIN}/members`);
  expect(res?.status()).toBe(404);
});
```

**パターン（ロール境界）**:
```typescript
test('member → /members ページにアクセス → /unauthorizedへリダイレクト', async ({ page }) => {
  await uiLogin(page, MEMBER.email, PASSWORD);
  await page.goto(`${DOMAINS.ADMIN}/members`);
  await expect(page).toHaveURL(new RegExp('/unauthorized'));
});
```

**配置**: Phase 1（基本的な境界）、Phase 2（複雑な権限制御）

### 3-3. CRUD操作テスト (CRUD Operation Tests)
**目的**: データの作成・読み取り・更新・削除が正しく動作することを確認

**パターン**:
```typescript
test('admin → ユーザーを招待できる', async ({ page }) => {
  await uiLogin(page, ADMIN.email, PASSWORD);
  await page.goto(`${DOMAINS.ADMIN}/members`);

  const uniqueEmail = `test-${Date.now()}@example.com`;
  await page.locator('input#email').fill(uniqueEmail);
  await page.locator('select#role').selectOption('member');
  await page.getByRole('button', { name: /招待する/i }).click();

  await expect(page.getByText(uniqueEmail)).toBeVisible();
});
```

**配置**: Phase 2

### 3-4. UI要素テスト (UI Element Tests)
**目的**: 画面上のUI要素（ボタン、フォーム、テーブルなど）が正しく表示されることを確認

**パターン**:
```typescript
test('admin → 招待フォームが表示される', async ({ page }) => {
  await uiLogin(page, ADMIN.email, PASSWORD);
  await page.goto(`${DOMAINS.ADMIN}/members`);

  await expect(page.locator('input#email')).toBeVisible();
  await expect(page.locator('select#role')).toBeVisible();
  await expect(page.getByRole('button', { name: /招待する/i })).toBeVisible();
});
```

**配置**: Phase 1（基本的なUI）、Phase 2（機能固有のUI）

### 3-5. エラーハンドリングテスト (Error Handling Tests)
**目的**: エラー状態が正しく処理され、ユーザーに適切なメッセージが表示されることを確認

**パターン（エラーページ）**:
```typescript
test('存在しないページ → 404エラーページ', async ({ page }) => {
  await uiLogin(page, MEMBER.email, PASSWORD);
  const res = await page.goto(`${DOMAINS.APP}/non-existent-page-${Date.now()}`);
  expect(res?.status()).toBe(404);
});
```

**パターン（フォームバリデーション）**:
```typescript
test('招待フォーム → 無効なメールでエラー表示', async ({ page }) => {
  await uiLogin(page, ADMIN.email, PASSWORD);
  await page.goto(`${DOMAINS.ADMIN}/members`);

  await page.locator('input#email').fill('invalid-email');
  await page.locator('select#role').selectOption('member');
  await page.getByRole('button', { name: /招待する/i }).click();

  await expect(page.getByText(/形式が正しくありません/i)).toBeVisible();
});
```

**配置**: Phase 1（基本的なエラーページ）、Phase 2（フォームバリデーション）

### 3-6. フィルタリング/検索テスト (Filtering/Search Tests)
**目的**: データのフィルタリング・検索機能が正しく動作することを確認

**パターン**:
```typescript
test('admin → アクション種別でフィルタリングできる', async ({ page }) => {
  await uiLogin(page, ADMIN.email, PASSWORD);
  await page.goto(`${DOMAINS.ADMIN}/audit-logs`);

  await page.locator('select#action-filter').selectOption('invite');

  const url = new URL(page.url());
  expect(url.searchParams.get('action')).toBe('invite');
});
```

**配置**: Phase 2

---

## 4. 命名規則

### 4-1. ファイル名
**形式**: `{機能名}.spec.ts`

**例**:
- `members-crud.spec.ts` - メンバー管理のCRUD操作
- `audit-logs.spec.ts` - 監査ログ機能
- `error-handling-basic.spec.ts` - 基本的なエラーハンドリング
- `boundary.spec.ts` - ドメイン/ロール境界テスト

### 4-2. test.describe
**形式**: 日本語で機能を明確に

**例**:
```typescript
test.describe('メンバー管理（CRUD操作）', () => {
  // ...
});

test.describe('エラーハンドリング（基本）', () => {
  // ...
});
```

### 4-3. testケース名
**形式**: `ロール → 操作 → 期待結果`

**例**:
```typescript
test('admin → メンバー一覧にアクセス可能', async ({ page }) => {
  // ...
});

test('member → adminドメインにアクセス → 404', async ({ page }) => {
  // ...
});

test('未認証 → 保護されたページにアクセス → ログインページにリダイレクト', async ({ page }) => {
  // ...
});
```

---

## 5. テストヘルパーの使用

### 5-1. uiLogin() の必須使用
認証が必要なテストでは、**必ず** `uiLogin()` ヘルパーを使用してください。

```typescript
import { uiLogin } from '../../../helpers/auth';

const ADMIN = { email: 'admin1@example.com' };
const PASSWORD = process.env.E2E_TEST_PASSWORD!;

test('admin → ...', async ({ page }) => {
  await uiLogin(page, ADMIN.email, PASSWORD);
  // テストの続き
});
```

**理由**:
- ログイン処理の一貫性を保つ
- CI環境での待機時間の調整が一箇所で管理できる
- ログイン失敗時のデバッグが容易

### 5-2. DOMAINS 定数の使用
ドメインURLは**必ず** `DOMAINS` 定数を使用してください。

```typescript
import { DOMAINS } from '../../../helpers/domains';

test('admin → ...', async ({ page }) => {
  await page.goto(`${DOMAINS.ADMIN}/members`);
  // テストの続き
});
```

**理由**:
- 環境変数から動的にURLを取得できる
- ポート番号やドメイン名の変更に強い

---

## 6. セレクタの優先順位

Playwrightでは、以下の優先順位でセレクタを使用してください：

### 優先度1: `getByRole()`
**用途**: ボタン、リンク、見出しなど、アクセシビリティロールが明確な要素

```typescript
await page.getByRole('button', { name: /招待する/i }).click();
await page.getByRole('heading', { name: /メンバー一覧/i });
await page.getByRole('link', { name: /ホームに戻る/i }).click();
```

**理由**: アクセシビリティに配慮した実装を促進

### 優先度2: `getByText()`
**用途**: テキストコンテンツで要素を特定する場合

```typescript
await expect(page.getByText(/403/i)).toBeVisible();
await expect(page.getByText(/アクセス権限がありません/i)).toBeVisible();
await expect(page.getByText(uniqueEmail)).toBeVisible();
```

**理由**: ユーザーが実際に見るテキストでテストを記述できる

### 優先度3: `locator()`
**用途**: フォームの入力フィールドなど、上記2つで対応できない場合

```typescript
await page.locator('input#email').fill('test@example.com');
await page.locator('select#role').selectOption('member');
```

**理由**: 柔軟性が高いが、実装の詳細に依存する

---

## 7. 実行コマンド

### 全テスト実行
```bash
pnpm test:e2e          # 全フェーズ（chromium）
pnpm test:e2e:ui       # 全フェーズ（chromium + UI mode）
```

### フェーズ別実行
```bash
pnpm test:e2e:p1
pnpm test:e2e:p2
pnpm test:e2e:p3
pnpm test:e2e:p4
pnpm test:e2e:p5
```
```bash
# Phase 1のみ
pnpm test:e2e:p1       # chromium
pnpm test:e2e:p1:ui    # chromium + UI mode

# Phase 2のみ
pnpm test:e2e:p2       # chromium
pnpm test:e2e:p2:ui    # chromium + UI mode
```

### 特定のテストファイルのみ実行
```bash
pnpm test:e2e e2e/tests/p1-baseline/admin/boundary.spec.ts
```

---

## 8. テスト追加のチェックリスト

新しいテストを追加する際は、以下を確認してください：

- [ ] 適切なフェーズ（p1 or p2）に配置している
- [ ] ファイル名が命名規則に従っている（`{機能名}.spec.ts`）
- [ ] `test.describe` で機能を明確に説明している
- [ ] テストケース名が「ロール → 操作 → 期待結果」の形式になっている
- [ ] `uiLogin()` ヘルパーを使用している（認証が必要な場合）
- [ ] `DOMAINS` 定数を使用している
- [ ] セレクタの優先順位を守っている（getByRole > getByText > locator）
- [ ] テストユーザーは `admin1@example.com`, `member1@example.com`, `owner1@example.com` を使用している
- [ ] パスワードは `process.env.E2E_TEST_PASSWORD!` を使用している
- [ ] 一意性が必要なデータ（メールアドレスなど）は `Date.now()` を使用している
- [ ] 非同期処理には適切な待機（`waitForURL`, `toBeVisible` など）を使用している

---

## 9. よくあるパターン

### 9-1. 一意のメールアドレスを生成する
```typescript
const uniqueEmail = `test-${Date.now()}@example.com`;
```

### 9-2. HTTPステータスコードを確認する
```typescript
const res = await page.goto(`${DOMAINS.ADMIN}/members`);
expect(res?.status()).toBe(404);
```

### 9-3. URLパラメータを確認する
```typescript
const url = new URL(page.url());
expect(url.searchParams.get('action')).toBe('invite');
```

### 9-4. 正規表現でURL/テキストをマッチさせる
```typescript
await expect(page).toHaveURL(new RegExp(`${DOMAINS.WWW}/login`));
await expect(page.getByText(/403/i)).toBeVisible();
```

---

## 10. 参考資料

### プロジェクト内ドキュメント
- [E2Eテストのパターン](./e2e-testing.md) - E2Eテストの基本原則
- [E2Eテストテンプレート](./e2e-test-templates.md) - テストファイルの構造とサンプル
- [マルチドメインパターン](./multi-domain.md) - ドメイン構成とCookie共有

### ADR
- [ADR-006: Supabase Session Cookie 専用認証](../adr/ADR-006-supabase-session-only-authentication.md)
- [ADR-007: 組織コンテキストのDB管理](../adr/ADR-007-org-context-in-database.md)

---

このルールに従うことで、**保守しやすく、拡張しやすいE2Eテスト**を構築できます。
