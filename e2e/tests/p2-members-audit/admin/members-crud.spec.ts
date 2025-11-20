import { test, expect } from '@playwright/test';
import { DOMAINS } from '../../../helpers/domains';
import { uiLogin } from '../../../helpers/auth';
import { resetUserToOrg1, createTestUser, deleteTestUser } from '../../../helpers/db';

const ADMIN = { email: 'admin1@example.com' };
const OWNER = { email: 'owner1@example.com' };
const MEMBER = { email: 'member1@example.com' };
const PASSWORD = process.env.E2E_TEST_PASSWORD!;

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

    await expect(page.locator('input#email')).toBeVisible();
    await expect(page.locator('select#role')).toBeVisible();
    await expect(page.getByRole('button', { name: /招待する/i })).toBeVisible();
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

  test('admin → ロール変更selectが表示される', async ({ page }) => {
    await uiLogin(page, ADMIN.email, PASSWORD);
    await page.goto(`${DOMAINS.ADMIN}/members`);

    const roleSelects = page.locator('table select');
    await expect(roleSelects.first()).toBeVisible();
  });

  test('admin → 削除ボタンが表示される', async ({ page }) => {
    await uiLogin(page, ADMIN.email, PASSWORD);
    await page.goto(`${DOMAINS.ADMIN}/members`);

    await expect(page.getByRole('button', { name: /削除/i }).first()).toBeVisible();
  });

  test('owner → 削除不可の表示がある', async ({ page }) => {
    await uiLogin(page, OWNER.email, PASSWORD);
    await page.goto(`${DOMAINS.ADMIN}/members`);

    await expect(page.getByText(/削除不可/i)).toBeVisible();
  });
});
