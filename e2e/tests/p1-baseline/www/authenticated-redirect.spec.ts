import { test, expect } from '@playwright/test';
import { DOMAINS } from '../../../helpers/domains';
import { uiLogin } from '../../../helpers/auth';

// 並列テスト用: このファイル専用のユーザー
const MEMBER = { email: 'member4@example.com' };
const PASSWORD = process.env.E2E_TEST_PASSWORD!;

test.describe('認証済みユーザーのWWWアクセス', () => {
  test('サインイン済み → wwwにアクセス → wwwページが表示される', async ({ page }) => {
    // サインイン
    await uiLogin(page, MEMBER.email, PASSWORD);

    // サインイン済みの状態でwwwトップにアクセス
    await page.goto(`${DOMAINS.WWW}`);

    // wwwのページがそのまま表示されることを確認
    await expect(page).toHaveURL(new RegExp(`${DOMAINS.WWW}`));
    // wwwのランディングページのコンテンツが表示される
    await expect(page.getByText(/SaaS Multi-Tenant Starter/i)).toBeVisible();
  });

  test('サインイン済み → /loginにアクセス → ログインページが表示される', async ({ page }) => {
    // サインイン
    await uiLogin(page, MEMBER.email, PASSWORD);

    // サインイン済みの状態で/loginにアクセス
    await page.goto(`${DOMAINS.WWW}/login`);

    // ログインページがそのまま表示されることを確認
    await expect(page).toHaveURL(new RegExp(`${DOMAINS.WWW}/login`));
  });

  test('サインイン済み → wwwのサインインボタンクリック → appへ遷移', async ({ page }) => {
    // サインイン
    await uiLogin(page, MEMBER.email, PASSWORD);

    // wwwトップにアクセス
    await page.goto(`${DOMAINS.WWW}`);

    // サインインボタンをクリック
    await page.getByRole('link', { name: /サインイン/i }).click();

    // appへ遷移することを確認
    await expect(page).toHaveURL(new RegExp(`${DOMAINS.APP}`));
  });
});
