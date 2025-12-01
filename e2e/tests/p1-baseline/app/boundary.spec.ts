import { test, expect } from '@playwright/test';
import { DOMAINS } from '../../../helpers/domains';
import { uiLogin } from '../../../helpers/auth';

// 並列テスト用: このファイル専用のユーザー
const MEMBER = { email: 'member8@example.com' };
const ADMIN = { email: 'admin3@example.com' };
const PASSWORD = process.env.E2E_TEST_PASSWORD!;

test.describe('APP domain boundary', () => {
  test('未認証 → www/login にリダイレクト', async ({ page }) => {
    await page.goto(`${DOMAINS.APP}/dashboard`);
    await expect(page).toHaveURL(new RegExp(`${DOMAINS.WWW}/login`));
  });

  test('member → APPにアクセス可能', async ({ page }) => {
    await uiLogin(page, MEMBER.email, PASSWORD);
    await page.goto(`${DOMAINS.APP}/dashboard`);
    await expect(page).toHaveURL(new RegExp(`${DOMAINS.APP}/dashboard`));
    await expect(page.getByText(/role:\s*member/i)).toBeVisible();
  });

  test('admin → APPにアクセス可能', async ({ page }) => {
    await uiLogin(page, ADMIN.email, PASSWORD);
    await page.goto(`${DOMAINS.APP}/dashboard`);
    await expect(page).toHaveURL(new RegExp(`${DOMAINS.APP}/dashboard`));
    await expect(page.getByText(/role:\s*admin/i)).toBeVisible();
  });
});
