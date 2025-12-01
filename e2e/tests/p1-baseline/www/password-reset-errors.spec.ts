import { test, expect } from '@playwright/test';
import { DOMAINS } from '../../../helpers/domains';

test.describe('パスワードリセット異常系', () => {
  test.describe('forgot-password 異常系', () => {
    test('存在しないメールアドレス → エラーを表示しない（セキュリティ）', async ({ page }) => {
      await page.goto(`${DOMAINS.WWW}/forgot-password`);

      await page.locator('#email').fill('nonexistent@example.com');
      await page.getByRole('button', { name: /送信|リセット/i }).click();

      // セキュリティ上、存在しないメールでもエラーを表示しない
      // 成功メッセージが表示されることを確認
      await expect(page.getByText(/メール.*送信|確認してください/i)).toBeVisible();

      // エラーメッセージが表示されていないことを確認
      const errorVisible = await page.getByText(/存在しません|見つかりません/i).isVisible().catch(() => false);
      expect(errorVisible).toBe(false);
    });
  });

  test.describe('reset-password 異常系', () => {
    test('パスワード不一致 → エラー表示', async ({ page }) => {
      await page.goto(`${DOMAINS.WWW}/reset-password`);

      await page.locator('#password').fill('NewPassword123!');
      await page.locator('#confirmPassword').fill('DifferentPassword123!');
      await page.getByRole('button', { name: /更新/i }).click();

      // パスワード不一致エラーが表示される（Server Actionからのエラー）
      await expect(page.getByText(/一致しません|match/i)).toBeVisible();
    });

    test('短すぎるパスワード → エラー表示', async ({ page }) => {
      await page.goto(`${DOMAINS.WWW}/reset-password`);

      await page.locator('#password').fill('short');
      await page.locator('#confirmPassword').fill('short');
      await page.getByRole('button', { name: /更新/i }).click();

      // Server Actionからのエラー：「6文字以上」
      await expect(page.getByText(/6文字以上|too short/i)).toBeVisible();
    });

    test('空のパスワード → エラー表示', async ({ page }) => {
      await page.goto(`${DOMAINS.WWW}/reset-password`);

      // 空のまま送信（Server Actionでバリデーション）
      await page.getByRole('button', { name: /更新/i }).click();

      // Server Actionからのエラー：「入力してください」
      await expect(page.getByText(/入力してください|required/i)).toBeVisible();
    });

    test('無効なセッション（トークンなし） → セッション無効エラー', async ({ page }) => {
      // トークンなしでreset-passwordにアクセス
      await page.goto(`${DOMAINS.WWW}/reset-password`);

      await page.locator('#password').fill('ValidPassword123!');
      await page.locator('#confirmPassword').fill('ValidPassword123!');
      await page.getByRole('button', { name: /更新/i }).click();

      // セッションがないのでエラーが表示される
      await expect(page.getByText(/セッション.*無効|もう一度.*リクエスト|エラー/i)).toBeVisible();
    });
  });
});
