import { test, expect } from '@playwright/test';
import { DOMAINS } from '../../../helpers/domains';
import { uiLogin } from '../../../helpers/auth';

const MEMBER = { email: 'member1@example.com' };
const PASSWORD = process.env.E2E_TEST_PASSWORD!;

test.describe('WWWログイン機能（完全版）', () => {
    test('ログイン成功 → APPダッシュボードへリダイレクト', async ({ page }) => {
    await page.goto(`${DOMAINS.WWW}/login`);

    // ログインフォームに入力
    await page.locator('input[name="email"], input[type="email"]').fill(MEMBER.email);
    await page.locator('input[name="password"], input[type="password"]').fill(PASSWORD);
    await page.getByRole('button', { name: /ログイン|login/i }).click();

    // APPダッシュボードへリダイレクトされることを確認
    await expect(page).toHaveURL(new RegExp(`${DOMAINS.APP}`));
  });

  test('ログイン失敗 → エラーメッセージ表示', async ({ page }) => {
    await page.goto(`${DOMAINS.WWW}/login`);

    // 誤った認証情報でログイン
    await page.locator('input[name="email"], input[type="email"]').fill(MEMBER.email);
    await page.locator('input[name="password"], input[type="password"]').fill('wrong-password');
    await page.getByRole('button', { name: /ログイン|login/i }).click();

    // エラーメッセージが表示されることを確認
    await expect(page.getByText(/invalid|incorrect|エラー|無効|認証に失敗/i)).toBeVisible();
  });

  test('ログアウト → セッション破棄してログインページへ', async ({ page }) => {
    // ログイン
    await uiLogin(page, MEMBER.email, PASSWORD);
    await page.goto(`${DOMAINS.APP}`);

    // ページ読み込みを待つ
    await page.waitForLoadState('networkidle');

    // ログアウトボタンをクリック（より具体的なセレクターを使用）
    const logoutButton = page.getByText(/ログアウト|logout|sign out/i).first();
    await logoutButton.click();

    // ログインページへのリダイレクトを待つ
    await page.waitForURL(new RegExp(`${DOMAINS.WWW}/login`));
    await expect(page).toHaveURL(new RegExp(`${DOMAINS.WWW}/login`));

    // 保護されたページへのアクセスが拒否されることを確認（セッション破棄の検証）
    await page.goto(`${DOMAINS.APP}`);
    await expect(page).toHaveURL(new RegExp(`${DOMAINS.WWW}/login`));
  });

  test('セッション永続性 → 再訪問時に自動ログイン', async ({ page }) => {
    // ログイン
    await uiLogin(page, MEMBER.email, PASSWORD);
    await page.goto(`${DOMAINS.APP}`);

    // ページをリロード
    await page.reload();

    // 引き続きログイン状態であることを確認（ログインページにリダイレクトされない）
    await expect(page).toHaveURL(new RegExp(`${DOMAINS.APP}`));
    await expect(page).not.toHaveURL(new RegExp(`${DOMAINS.WWW}/login`));
  });
});
