import { test, expect } from '@playwright/test';
import { DOMAINS } from '../../../helpers/domains';

test.describe('パスワードリセット機能', () => {
  test('ログインページ → パスワードリセットリンクが表示される', async ({ page }) => {
    await page.goto(`${DOMAINS.WWW}/login`);

    await expect(page.getByRole('link', { name: /パスワード.*忘れ/i })).toBeVisible();
  });

  test('パスワードリセットリンク → forgot-passwordページへ遷移', async ({ page }) => {
    await page.goto(`${DOMAINS.WWW}/login`);

    await page.getByRole('link', { name: /パスワード.*忘れ/i }).click();

    await expect(page).toHaveURL(new RegExp(`${DOMAINS.WWW}/forgot-password`));
  });

  test('forgot-password → メール入力フォームが表示される', async ({ page }) => {
    await page.goto(`${DOMAINS.WWW}/forgot-password`);

    await expect(page.locator('#email')).toBeVisible();
    await expect(page.getByRole('button', { name: /送信|リセット/i })).toBeVisible();
  });

  test('forgot-password → 有効なメール送信 → 成功メッセージ', async ({ page }) => {
    await page.goto(`${DOMAINS.WWW}/forgot-password`);

    // 並列テスト用: このファイル専用のユーザー
    await page.locator('#email').fill('member6@example.com');
    await page.getByRole('button', { name: /送信|リセット/i }).click();

    await expect(page.getByText(/メール.*送信|確認してください/i)).toBeVisible();
  });

  test('forgot-password → 無効なメール形式 → HTML5バリデーション', async ({ page }) => {
    await page.goto(`${DOMAINS.WWW}/forgot-password`);

    const emailInput = page.locator('#email');
    await emailInput.fill('invalid-email');
    await page.getByRole('button', { name: /送信|リセット/i }).click();

    // HTML5のtype="email"バリデーションにより送信がブロックされる
    // validity.typeMismatch が true になっていることを確認
    const isInvalid = await emailInput.evaluate((el: HTMLInputElement) => !el.validity.valid);
    expect(isInvalid).toBe(true);
  });

  test('forgot-password → 空メール → エラー表示', async ({ page }) => {
    await page.goto(`${DOMAINS.WWW}/forgot-password`);

    await page.getByRole('button', { name: /送信|リセット/i }).click();

    await expect(page.getByText(/入力してください/i)).toBeVisible();
  });

  test('forgot-password → サインインページへ戻るリンク', async ({ page }) => {
    await page.goto(`${DOMAINS.WWW}/forgot-password`);

    await page.getByRole('link', { name: /サインイン.*戻る/i }).click();

    await expect(page).toHaveURL(new RegExp(`${DOMAINS.WWW}/login`));
  });

  test('reset-password → パスワード入力フォームが表示される', async ({ page }) => {
    await page.goto(`${DOMAINS.WWW}/reset-password`);

    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('#confirmPassword')).toBeVisible();
    await expect(page.getByRole('button', { name: /更新/i })).toBeVisible();
  });

  test('reset-password → サインインページへ戻るリンク', async ({ page }) => {
    await page.goto(`${DOMAINS.WWW}/reset-password`);

    await page.getByRole('link', { name: /サインイン.*戻る/i }).click();

    await expect(page).toHaveURL(new RegExp(`${DOMAINS.WWW}/login`));
  });
});
