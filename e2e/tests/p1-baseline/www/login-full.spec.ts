import { test, expect } from '@playwright/test';
import { DOMAINS } from '../../../helpers/domains';
import { uiLogin } from '../../../helpers/auth';

// 並列テスト用: このファイル専用のユーザー
const MEMBER = { email: 'member5@example.com' };
const PASSWORD = process.env.E2E_TEST_PASSWORD!;

test.describe('WWWサインイン機能（完全版）', () => {
    test('サインイン成功 → APPダッシュボードへリダイレクト', async ({ page }) => {
    await page.goto(`${DOMAINS.WWW}/login`);

    // サインインフォームに入力
    await page.locator('input[name="email"], input[type="email"]').fill(MEMBER.email);
    await page.locator('input[name="password"], input[type="password"]').fill(PASSWORD);
    await page.getByRole('button', { name: /サインイン|login/i }).click();

    // APPダッシュボードへリダイレクトされることを確認
    await expect(page).toHaveURL(new RegExp(`${DOMAINS.APP}`));
  });

  test('サインイン失敗 → エラーメッセージ表示', async ({ page }) => {
    await page.goto(`${DOMAINS.WWW}/login`);

    // 誤った認証情報でサインイン
    await page.locator('input[name="email"], input[type="email"]').fill(MEMBER.email);
    await page.locator('input[name="password"], input[type="password"]').fill('wrong-password');
    await page.getByRole('button', { name: /サインイン|login/i }).click();

    // エラーメッセージが表示されることを確認
    await expect(page.getByText(/invalid|incorrect|エラー|無効|認証に失敗/i)).toBeVisible();
  });

  test('サインアウト → セッション破棄してサインインページへ', async ({ page }) => {
    // サインイン
    await uiLogin(page, MEMBER.email, PASSWORD);
    await page.goto(`${DOMAINS.APP}`);

    // ページ読み込みを待つ
    await page.waitForLoadState('domcontentloaded');

    // サインアウトボタンをクリック（より具体的なセレクターを使用）
    const logoutButton = page.getByText(/サインアウト|logout|sign out/i).first();
    await logoutButton.click();

    // サインインページへのリダイレクトを待つ
    await page.waitForURL(new RegExp(`${DOMAINS.WWW}/login`));
    await expect(page).toHaveURL(new RegExp(`${DOMAINS.WWW}/login`));

    // 保護されたページへのアクセスが拒否されることを確認（セッション破棄の検証）
    await page.goto(`${DOMAINS.APP}`);
    await expect(page).toHaveURL(new RegExp(`${DOMAINS.WWW}/login`));
  });

  test('セッション永続性 → 再訪問時に自動サインイン', async ({ page }) => {
    // サインイン
    await uiLogin(page, MEMBER.email, PASSWORD);
    await page.goto(`${DOMAINS.APP}`);

    // ページをリロード
    await page.reload();

    // 引き続きサインイン状態であることを確認（サインインページにリダイレクトされない）
    await expect(page).toHaveURL(new RegExp(`${DOMAINS.APP}`));
    await expect(page).not.toHaveURL(new RegExp(`${DOMAINS.WWW}/login`));
  });
});
