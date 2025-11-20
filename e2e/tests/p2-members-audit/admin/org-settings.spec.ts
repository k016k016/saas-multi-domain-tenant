import { test, expect } from '@playwright/test';
import { DOMAINS } from '../../../helpers/domains';
import { uiLogin } from '../../../helpers/auth';
import { resetUserToOrg1 } from '../../../helpers/db';

const ADMIN = { email: 'admin1@example.com' };
const OWNER = { email: 'owner1@example.com' };
const MEMBER = { email: 'member-switcher@example.com' };
const PASSWORD = process.env.E2E_TEST_PASSWORD!;

test.describe('/org-settings アクセス制限', () => {
  // 各テスト前にmember1をorg1（member権限）にリセット
  test.beforeEach(async () => {
    await resetUserToOrg1(MEMBER.email);
  });

  test('owner → 組織設定ページにアクセス可能', async ({ page }) => {
    await uiLogin(page, OWNER.email, PASSWORD);
    await page.goto(`${DOMAINS.ADMIN}/org-settings`);

    // ページが表示される
    await expect(page.getByRole('heading', { name: /組織設定/i })).toBeVisible();
  });

  test('admin → 組織設定ページにアクセス不可（/unauthorizedへリダイレクト）', async ({ page }) => {
    await uiLogin(page, ADMIN.email, PASSWORD);

    const response = await page.goto(`${DOMAINS.ADMIN}/org-settings`);
    await expect(page).toHaveURL(new RegExp(`${DOMAINS.ADMIN}/unauthorized`));
    await expect(page.getByRole('heading', { name: /アクセス権限がありません/i })).toBeVisible();
    expect(response?.status()).toBe(200);
  });

  test('member → 組織設定ページにアクセス不可（/unauthorizedへリダイレクト）', async ({ page }) => {
    await uiLogin(page, MEMBER.email, PASSWORD);

    const response = await page.goto(`${DOMAINS.ADMIN}/org-settings`);
    await expect(page).toHaveURL(new RegExp(`${DOMAINS.ADMIN}/unauthorized`));
    await expect(page.getByRole('heading', { name: /アクセス権限がありません/i })).toBeVisible();
    expect(response?.status()).toBe(200);
  });
});
