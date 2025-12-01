import { test, expect } from '@playwright/test';
import { DOMAINS } from '../../helpers/domains';
import { uiLogin } from '../../helpers/auth';
import { resetUserToOrg1 } from '../../helpers/db';

const MEMBER = { email: 'member1@example.com' };
const ADMIN = { email: 'admin1@example.com' };
const OWNER = { email: 'owner1@example.com' };
const OPS = { email: 'ops1@example.com' };
const PASSWORD = process.env.E2E_TEST_PASSWORD!;

test.describe('ドメイン間アクセス制御', () => {
  test.beforeEach(async () => {
    // テスト前に org1 にリセット
    await resetUserToOrg1(MEMBER.email);
    await resetUserToOrg1(ADMIN.email);
    await resetUserToOrg1(OWNER.email);
  });

  test.describe('一般ユーザーから OPS ドメインへのアクセス', () => {
    test('owner → /ops → 404（OPSドメインへのアクセス不可）', async ({ page }) => {
      await uiLogin(page, OWNER.email, PASSWORD);

      const res = await page.goto(`${DOMAINS.OPS}`);

      expect(res?.status()).toBe(404);
      await expect(page.locator('body')).toContainText(/404|Not Found/i);
    });

    test('admin → /ops/orgs → 404', async ({ page }) => {
      await uiLogin(page, ADMIN.email, PASSWORD);

      const res = await page.goto(`${DOMAINS.OPS}/orgs`);

      expect(res?.status()).toBe(404);
      await expect(page.locator('body')).toContainText(/404|Not Found/i);
    });

    test('member → /ops → 404', async ({ page }) => {
      await uiLogin(page, MEMBER.email, PASSWORD);

      const res = await page.goto(`${DOMAINS.OPS}`);

      expect(res?.status()).toBe(404);
      await expect(page.locator('body')).toContainText(/404|Not Found/i);
    });
  });

  test.describe('OPS ユーザーの他ドメインアクセス', () => {
    test('ops → /admin → 権限に応じたアクセス', async ({ page }) => {
      await uiLogin(page, OPS.email, PASSWORD);

      // ops1はorg1でadmin権限を持つ
      const res = await page.goto(`${DOMAINS.ADMIN}/members`);

      expect(res?.ok()).toBeTruthy();
      await expect(page.getByRole('heading', { name: /メンバー管理/i })).toBeVisible();
    });

    test('ops → /ops/orgs → アクセス可能', async ({ page }) => {
      await uiLogin(page, OPS.email, PASSWORD);

      const res = await page.goto(`${DOMAINS.OPS}/orgs`);
      expect(res?.ok()).toBeTruthy();
      await expect(page.getByRole('heading', { name: /組織一覧/i })).toBeVisible();
    });
  });

  test.describe('APP ドメインのアクセス', () => {
    test('owner → /app/dashboard → アクセス可能', async ({ page }) => {
      await uiLogin(page, OWNER.email, PASSWORD);

      await page.goto(`${DOMAINS.APP}/dashboard`);
      await expect(page).toHaveURL(new RegExp(`${DOMAINS.APP}/dashboard`));
    });

    test('admin → /app/dashboard → アクセス可能', async ({ page }) => {
      await uiLogin(page, ADMIN.email, PASSWORD);

      await page.goto(`${DOMAINS.APP}/dashboard`);
      await expect(page).toHaveURL(new RegExp(`${DOMAINS.APP}/dashboard`));
    });

    test('member → /app/dashboard → アクセス可能', async ({ page }) => {
      await uiLogin(page, MEMBER.email, PASSWORD);

      await page.goto(`${DOMAINS.APP}/dashboard`);
      await expect(page).toHaveURL(new RegExp(`${DOMAINS.APP}/dashboard`));
    });
  });

  test.describe('WWW ドメイン（公開ページ）', () => {
    test('未認証 → /www/login → アクセス可能', async ({ page }) => {
      await page.context().clearCookies();

      const res = await page.goto(`${DOMAINS.WWW}/login`);
      expect(res?.ok()).toBeTruthy();
      await expect(page.locator('#email')).toBeVisible();
    });

    test('認証済み → /www/login → リダイレクトまたはログインページ表示', async ({ page }) => {
      await uiLogin(page, MEMBER.email, PASSWORD);

      await page.goto(`${DOMAINS.WWW}/login`);

      // 認証済みの場合、/appにリダイレクトされるか、ログインページが表示される
      const url = page.url();
      const isRedirected = url.includes(DOMAINS.APP);
      const isLoginPage = url.includes('/login');

      expect(isRedirected || isLoginPage).toBe(true);
    });
  });

  test.describe('ドメイン間のセッション共有', () => {
    test('www でログイン → app にセッションが引き継がれる', async ({ page }) => {
      await uiLogin(page, MEMBER.email, PASSWORD);

      // www でログイン後、app ドメインにアクセス
      await page.goto(`${DOMAINS.APP}/dashboard`);

      // セッションが有効ならダッシュボードが表示される
      await expect(page).toHaveURL(new RegExp(`${DOMAINS.APP}/dashboard`));
    });

    test('www でログイン → admin にセッションが引き継がれる（権限に応じて）', async ({ page }) => {
      await uiLogin(page, OWNER.email, PASSWORD);

      // www でログイン後、admin ドメインにアクセス
      const res = await page.goto(`${DOMAINS.ADMIN}/members`);

      // ownerならアクセス可能
      expect(res?.ok()).toBeTruthy();
      await expect(page.getByRole('heading', { name: /members/i })).toBeVisible();
    });
  });
});
