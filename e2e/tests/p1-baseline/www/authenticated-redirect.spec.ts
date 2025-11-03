import { test, expect } from '@playwright/test';
import { DOMAINS } from '../../../helpers/domains';
import { uiLogin } from '../../../helpers/auth';

const MEMBER = { email: 'member1@example.com' };
const PASSWORD = process.env.E2E_TEST_PASSWORD!;

test.describe('認証済みユーザーのWWWリダイレクト', () => {
  test('ログイン済み → www/loginアクセス → APPへリダイレクト', async ({ page }) => {
    // ログイン
    await uiLogin(page, MEMBER.email, PASSWORD);

    // ログイン済みの状態でwww/loginにアクセス
    await page.goto(`${DOMAINS.WWW}/login`);

    // APPダッシュボードへリダイレクトされることを確認
    // (ログイン済みユーザーはログインページにアクセスする必要がないため)
    await expect(page).toHaveURL(new RegExp(`${DOMAINS.APP}`));
    await expect(page).not.toHaveURL(new RegExp(`${DOMAINS.WWW}/login`));
  });
});
