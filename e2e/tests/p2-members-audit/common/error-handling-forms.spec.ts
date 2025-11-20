import { test, expect } from '@playwright/test';
import { DOMAINS } from '../../../helpers/domains';
import { uiLogin } from '../../../helpers/auth';
import { resetUserToOrg1 } from '../../../helpers/db';

const ADMIN = { email: 'admin1@example.com' };
const MEMBER = { email: 'member1@example.com' };
const PASSWORD = process.env.E2E_TEST_PASSWORD!;

test.describe('エラーハンドリング（フォーム）', () => {
  // 各テスト前にmember1をorg1（member権限）にリセット
  test.beforeEach(async () => {
    await resetUserToOrg1(MEMBER.email);
  });

  test('招待フォーム → 無効なメールでエラー表示', async ({ page }) => {
    await uiLogin(page, ADMIN.email, PASSWORD);
    await page.goto(`${DOMAINS.ADMIN}/members`);

    // フォームに入力（氏名とパスワードも必要）
    await page.locator('input#name').fill('テストユーザー');
    // ブラウザのHTML5バリデーションを通過するが、サーバー側で無効なメール
    // @とドメイン部分が必要だが、TLDがない形式
    await page.locator('input#email').fill('invalid@test');
    await page.locator('input#password').fill(PASSWORD);
    await page.locator('select#role').selectOption('member');
    await page.getByRole('button', { name: /追加/i }).click();

    // エラーメッセージ: "メールアドレスの形式が正しくありません"
    await expect(page.getByText(/形式が正しくありません/i)).toBeVisible();
  });
});
