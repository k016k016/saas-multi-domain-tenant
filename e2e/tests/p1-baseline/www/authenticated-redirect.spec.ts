import { test, expect } from '@playwright/test';
import { DOMAINS } from '../../../helpers/domains';
import { uiLogin } from '../../../helpers/auth';

const MEMBER = { email: 'member1@example.com' };
const PASSWORD = process.env.E2E_TEST_PASSWORD!;

test.describe('認証済みユーザーのWWWリダイレクト', () => {
  test('サインイン済み → /loginアクセス → APPへリダイレクト', async ({ page }) => {
    // サインイン
    await uiLogin(page, MEMBER.email, PASSWORD);

    // サインイン済みの状態で/loginにアクセス
    await page.goto(`${DOMAINS.WWW}/login`);

    // APPダッシュボードへリダイレクトされることを確認
    // (サインイン済みユーザーはサインインページにアクセスする必要がないため)
    await expect(page).toHaveURL(new RegExp(`${DOMAINS.APP}`));
    await expect(page).not.toHaveURL(new RegExp(`${DOMAINS.WWW}/login`));
  });
});
