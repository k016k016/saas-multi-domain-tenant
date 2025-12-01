import { test, expect } from '@playwright/test';
import { DOMAINS } from '../../../helpers/domains';
import { uiLogin } from '../../../helpers/auth';

const MEMBER = { email: 'member1@example.com' };
const PASSWORD = process.env.E2E_TEST_PASSWORD!;

test.describe('ログアウト機能', () => {
  test('正常ログアウト → www/loginにリダイレクト、Cookieクリア', async ({ page }) => {
    // ログイン
    await uiLogin(page, MEMBER.email, PASSWORD);
    await page.goto(`${DOMAINS.APP}/dashboard`);
    await expect(page).toHaveURL(new RegExp(`${DOMAINS.APP}/dashboard`));

    // サインアウトボタンをクリック
    const logoutButton = page.getByRole('button', { name: /サインアウト/i });
    await logoutButton.click();

    // www/loginにリダイレクトされることを確認
    await expect(page).toHaveURL(new RegExp(`${DOMAINS.WWW}/login`), { timeout: 20_000 });

    // Cookieがクリアされていることを確認
    const cookies = await page.context().cookies();
    const sessionCookies = cookies.filter(
      (c) => c.name.startsWith('sb-') && /access-token|refresh-token/i.test(c.name)
    );
    expect(sessionCookies.length).toBe(0);
  });

  test('ログアウト後に保護ページにアクセス → www/loginにリダイレクト', async ({ page }) => {
    // ログイン
    await uiLogin(page, MEMBER.email, PASSWORD);
    await page.goto(`${DOMAINS.APP}/dashboard`);

    // サインアウト
    const logoutButton = page.getByRole('button', { name: /サインアウト/i });
    await logoutButton.click();
    await expect(page).toHaveURL(new RegExp(`${DOMAINS.WWW}/login`), { timeout: 20_000 });

    // 保護ページに直接アクセス
    await page.goto(`${DOMAINS.APP}/dashboard`);

    // ログインページにリダイレクトされることを確認
    await expect(page).toHaveURL(new RegExp(`${DOMAINS.WWW}/login`));
  });
});
