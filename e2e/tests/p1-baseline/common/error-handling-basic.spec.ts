import { test, expect } from '@playwright/test';
import { DOMAINS } from '../../../helpers/domains';
import { uiLogin } from '../../../helpers/auth';
import { resetUserToOrg1 } from '../../../helpers/db';

const MEMBER = { email: 'member1@example.com' };
const ADMIN = { email: 'admin1@example.com' };
const PASSWORD = process.env.E2E_TEST_PASSWORD!;

test.describe('エラーハンドリング（基本）', () => {
  // 各テスト前にmember1をorg1（member権限）にリセット
  // これにより他のテスト（特にorg-switching.spec.ts）による状態汚染を防ぐ
  test.beforeEach(async () => {
    await resetUserToOrg1(MEMBER.email);
  });
  test('未認証 → 保護されたページにアクセス → サインインページにリダイレクト', async ({ page }) => {
    await page.goto(`${DOMAINS.ADMIN}/members`);

    await expect(page).toHaveURL(new RegExp(`${DOMAINS.WWW}/login`));
  });

  test('member → adminドメインにアクセス → /unauthorizedにリダイレクト', async ({ page }) => {
    await uiLogin(page, MEMBER.email, PASSWORD);
    await page.goto(`${DOMAINS.ADMIN}/members`);

    // UX改善: 権限エラー時は専用の/unauthorizedページにリダイレクト
    await expect(page).toHaveURL(new RegExp(`${DOMAINS.ADMIN}/unauthorized`));
  });

  test('admin → /unauthorized ページが表示される', async ({ page }) => {
    await uiLogin(page, ADMIN.email, PASSWORD);
    await page.goto(`${DOMAINS.ADMIN}/unauthorized`);

    await expect(page.getByText(/403/i)).toBeVisible();
    await expect(page.getByText(/アクセス権限がありません/i)).toBeVisible();
  });

    test('admin → /unauthorized からホームに戻れる', async ({ page }) => {
    await uiLogin(page, ADMIN.email, PASSWORD);
    await page.goto(`${DOMAINS.ADMIN}/unauthorized`);

    await page.getByText('ホームに戻る').click();
    await expect(page).toHaveURL(/\//);
  });

  test('app → /unauthorized ページが表示される', async ({ page }) => {
    await uiLogin(page, MEMBER.email, PASSWORD);
    await page.goto(`${DOMAINS.APP}/unauthorized`);

    await expect(page.getByText(/403/i)).toBeVisible();
    await expect(page.getByText(/アクセス権限がありません/i)).toBeVisible();
  });

  test('存在しないページ → 404エラーページ', async ({ page }) => {
    await uiLogin(page, MEMBER.email, PASSWORD);
    const res = await page.goto(`${DOMAINS.APP}/non-existent-page-${Date.now()}`);

    expect(res?.status()).toBe(404);
  });
});
