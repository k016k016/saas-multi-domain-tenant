import { test, expect } from '@playwright/test';
import { DOMAINS } from '../../../helpers/domains';
import { uiLogin } from '../../../helpers/auth';

const ADMIN = { email: 'admin1@example.com' };
const PASSWORD = process.env.E2E_TEST_PASSWORD!;

test.describe('エラーハンドリング（フォーム）', () => {
  test('招待フォーム → 無効なメールでエラー表示', async ({ page }) => {
    await uiLogin(page, ADMIN.email, PASSWORD);
    await page.goto(`${DOMAINS.ADMIN}/members`);

    await page.locator('input#email').fill('invalid-email');
    await page.locator('select#role').selectOption('member');
    await page.getByRole('button', { name: /招待する/i }).click();

    await expect(page.getByText(/形式が正しくありません/i)).toBeVisible();
  });
});
