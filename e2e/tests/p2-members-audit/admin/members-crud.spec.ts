import { test, expect } from '@playwright/test';
import { DOMAINS } from '../../../helpers/domains';
import { uiLogin } from '../../../helpers/auth';
import { resetUserToOrg1, createTestUser, deleteTestUser } from '../../../helpers/db';

const ADMIN = { email: 'admin1@example.com' };
const OWNER = { email: 'owner1@example.com' };
const MEMBER = { email: 'member1@example.com' };
const PASSWORD = process.env.E2E_TEST_PASSWORD!;

// テスト用ユーザー
const TEST_USER = {
  email: `test-${Date.now()}@example.com`,
  name: 'テストユーザー',
  password: PASSWORD,
};

test.describe('admin/members CRUD', () => {
  // 各テスト前にmember1をorg1（member権限）にリセット
  test.beforeEach(async () => {
    await resetUserToOrg1(MEMBER.email);
  });
  test('admin → メンバー一覧にアクセス可能', async ({ page }) => {
    await uiLogin(page, ADMIN.email, PASSWORD);
    await page.goto(`${DOMAINS.ADMIN}/members`);

    await expect(page.getByRole('heading', { name: /メンバー管理/i })).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();
  });

  test('owner → メンバー一覧にアクセス可能', async ({ page }) => {
    await uiLogin(page, OWNER.email, PASSWORD);
    await page.goto(`${DOMAINS.ADMIN}/members`);

    await expect(page.getByRole('heading', { name: /メンバー管理/i })).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();
  });

  test('member → メンバー一覧にアクセス不可（/unauthorizedへリダイレクト）', async ({ page }) => {
    await uiLogin(page, MEMBER.email, PASSWORD);
    await page.goto(`${DOMAINS.ADMIN}/members`);

    // UX改善: 権限エラー時は専用の/unauthorizedページにリダイレクト
    await expect(page).toHaveURL(new RegExp(`${DOMAINS.ADMIN}/unauthorized`));
  });

  test('admin → 招待フォームが表示される', async ({ page }) => {
    await uiLogin(page, ADMIN.email, PASSWORD);
    await page.goto(`${DOMAINS.ADMIN}/members`);

    await expect(page.locator('input#name')).toBeVisible();
    await expect(page.locator('input#email')).toBeVisible();
    await expect(page.locator('input#password')).toBeVisible();
    await expect(page.locator('select#role')).toBeVisible();
    await expect(page.getByRole('button', { name: /追加/i })).toBeVisible();
  });

  test('admin → メンバー一覧にテーブル行が表示される', async ({ page }) => {
    await uiLogin(page, ADMIN.email, PASSWORD);
    await page.goto(`${DOMAINS.ADMIN}/members`);

    // メンバー一覧テーブルが表示される
    await expect(page.getByRole('table')).toBeVisible();
    // 最低1人（admin1）がメンバー一覧に表示される
    const rows = page.locator('table tbody tr');
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('admin → 編集・削除ボタンが表示される', async ({ page }) => {
    await uiLogin(page, ADMIN.email, PASSWORD);
    await page.goto(`${DOMAINS.ADMIN}/members`);

    await expect(page.getByRole('button', { name: /編集/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /削除/i }).first()).toBeVisible();
  });

  test('admin → 編集モーダルが開く', async ({ page }) => {
    await uiLogin(page, ADMIN.email, PASSWORD);
    await page.goto(`${DOMAINS.ADMIN}/members`);

    // 編集ボタンをクリック
    await page.getByRole('button', { name: /編集/i }).first().click();

    // モーダルが表示される
    await expect(page.getByRole('heading', { name: /ユーザー情報を編集/i })).toBeVisible();
    await expect(page.locator('input#edit-name')).toBeVisible();
    await expect(page.locator('input#edit-email')).toBeVisible();
    await expect(page.locator('select#edit-role')).toBeVisible();
  });

  test('admin → ユーザー追加が成功する', async ({ page }) => {
    await uiLogin(page, ADMIN.email, PASSWORD);
    await page.goto(`${DOMAINS.ADMIN}/members`);

    // ユニークなメールアドレスを生成
    const uniqueEmail = `test-${Date.now()}@example.com`;

    // フォームに入力
    await page.locator('input#name').fill('新規テストユーザー');
    await page.locator('input#email').fill(uniqueEmail);
    await page.locator('input#password').fill(PASSWORD);
    await page.locator('select#role').selectOption('member');

    // 追加ボタンをクリック
    await page.getByRole('button', { name: /追加/i }).click();

    // 成功メッセージが表示される
    await expect(page.getByText(/を追加しました/i)).toBeVisible();

    // 一覧に新しいユーザーが表示される
    await expect(page.getByText(uniqueEmail)).toBeVisible();
  });

  test('admin → ユーザー編集が成功する', async ({ page }) => {
    await uiLogin(page, ADMIN.email, PASSWORD);
    await page.goto(`${DOMAINS.ADMIN}/members`);

    // 最初の編集ボタンをクリック
    await page.getByRole('button', { name: /編集/i }).first().click();

    // モーダルが表示される
    await expect(page.getByRole('heading', { name: /ユーザー情報を編集/i })).toBeVisible();

    // 氏名を変更
    const newName = `編集済み-${Date.now()}`;
    await page.locator('input#edit-name').fill(newName);

    // 保存ボタンをクリック
    await page.getByRole('button', { name: /保存/i }).click();

    // モーダルが閉じる
    await expect(page.getByRole('heading', { name: /ユーザー情報を編集/i })).not.toBeVisible();

    // 一覧に変更が反映される
    await expect(page.getByText(newName)).toBeVisible();
  });

  test('admin → ユーザー削除が成功する', async ({ page }) => {
    await uiLogin(page, ADMIN.email, PASSWORD);
    await page.goto(`${DOMAINS.ADMIN}/members`);

    // まず新しいユーザーを追加
    const uniqueEmail = `delete-test-${Date.now()}@example.com`;
    await page.locator('input#name').fill('削除テストユーザー');
    await page.locator('input#email').fill(uniqueEmail);
    await page.locator('input#password').fill(PASSWORD);
    await page.locator('select#role').selectOption('member');
    await page.getByRole('button', { name: /追加/i }).click();

    // 追加されたことを確認
    await expect(page.getByText(uniqueEmail)).toBeVisible();

    // 削除ダイアログをacceptするように設定
    page.on('dialog', dialog => dialog.accept());

    // 追加したユーザーの削除ボタンをクリック
    const row = page.locator('tr', { hasText: uniqueEmail });
    await row.getByRole('button', { name: /削除/i }).click();

    // 一覧から削除される
    await expect(page.getByText(uniqueEmail)).not.toBeVisible();
  });
});
