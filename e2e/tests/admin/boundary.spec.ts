import { test, expect } from '@playwright/test';
import { DOMAINS } from '../../helpers/domains';
import { uiLogin } from '../../helpers/auth';

const MEMBER = { email: 'member1@example.com' };
const OWNER = { email: 'owner1@example.com' };
const PASSWORD = process.env.E2E_TEST_PASSWORD!;

test.describe('ADMIN domain boundary', () => {
  test('未認証 → www/login にリダイレクト', async ({ page }) => {
    await page.goto(`${DOMAINS.ADMIN}/members`);
    await expect(page).toHaveURL(new RegExp(`${DOMAINS.WWW}/login`));
  });

  test('member → 403（リダイレクトしない）', async ({ page }) => {
    await uiLogin(page, MEMBER.email, PASSWORD);
    const res = await page.goto(`${DOMAINS.ADMIN}/members`);
    expect(res?.status()).toBe(403);
  });

  test('owner → 200 でアクセス可能', async ({ page }) => {
    await uiLogin(page, OWNER.email, PASSWORD);
    const res = await page.goto(`${DOMAINS.ADMIN}/members`);
    expect(res?.ok()).toBeTruthy();
    await expect(page.getByRole('heading', { name: /members/i })).toBeVisible();
  });
});
