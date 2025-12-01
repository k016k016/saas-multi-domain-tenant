/**
 * セッション期限切れテスト
 *
 * Cookie削除後のページアクセスがログインページへリダイレクトされることを検証。
 */
import { test, expect } from '@playwright/test';
import { uiLogin } from '../../helpers/auth';
import { DOMAINS } from '../../helpers/domains';

const MEMBER6 = { email: 'member6@example.com' };
const PASSWORD = process.env.E2E_TEST_PASSWORD!;

test.describe('Session expiry handling', () => {
  test('Cookie削除後のページアクセスがログインへリダイレクト', async ({ page }) => {
    // ログインしてセッションを確立
    await uiLogin(page, MEMBER6.email, PASSWORD);

    // ダッシュボードにアクセスできることを確認
    await page.goto(`${DOMAINS.APP}/dashboard`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1')).toContainText('ダッシュボード');

    // Cookieを削除してセッションを無効化
    await page.context().clearCookies();

    // 再度ダッシュボードにアクセス
    await page.goto(`${DOMAINS.APP}/dashboard`, { waitUntil: 'domcontentloaded' });

    // ログインページにリダイレクトされることを確認
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test('LocalStorage/SessionStorage削除後もCookie削除でセッション無効', async ({ page }) => {
    await uiLogin(page, MEMBER6.email, PASSWORD);

    // ストレージを削除
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // Cookieがあれば引き続きアクセス可能
    await page.goto(`${DOMAINS.APP}/dashboard`, { waitUntil: 'domcontentloaded' });
    // Cookieが残っていればダッシュボードが表示される
    // （このテストはCookieベースの認証が機能していることの確認）

    // Cookieも削除
    await page.context().clearCookies();

    // 再度アクセス
    await page.goto(`${DOMAINS.APP}/dashboard`, { waitUntil: 'domcontentloaded' });

    // ログインページにリダイレクト
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });
});
