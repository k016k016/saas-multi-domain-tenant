import { test, expect } from '@playwright/test';
import { DOMAINS } from '../../../helpers/domains';
import { uiLogin } from '../../../helpers/auth';

const MEMBER = { email: 'member1@example.com' };
const PASSWORD = process.env.E2E_TEST_PASSWORD!;

test.describe('プロフィール編集機能', () => {
  test('member → プロフィールページにアクセス可能', async ({ page }) => {
    await uiLogin(page, MEMBER.email, PASSWORD);
    await page.goto(`${DOMAINS.APP}/profile`);

    await expect(page).toHaveURL(new RegExp(`${DOMAINS.APP}/profile`));
    await expect(page.getByText('プロフィール編集')).toBeVisible();
  });

  test('プロフィールページ → 現在の名前・メール・ロールが表示される', async ({ page }) => {
    await uiLogin(page, MEMBER.email, PASSWORD);
    await page.goto(`${DOMAINS.APP}/profile`);

    // メールアドレス表示確認
    await expect(page.getByText(MEMBER.email)).toBeVisible();
    // ロール表示確認
    await expect(page.getByText(/ロール:.*member/i)).toBeVisible();
  });

  test('プロフィールページ → 名前変更が成功する', async ({ page }) => {
    await uiLogin(page, MEMBER.email, PASSWORD);
    await page.goto(`${DOMAINS.APP}/profile`);

    const newName = `TestUser_${Date.now()}`;
    await page.locator('#name').fill(newName);
    await page.getByRole('button', { name: /名前を更新/ }).click();

    await expect(page.getByText('名前を更新しました')).toBeVisible();
  });

  test('プロフィールページ → 空の名前でエラー表示', async ({ page }) => {
    await uiLogin(page, MEMBER.email, PASSWORD);
    await page.goto(`${DOMAINS.APP}/profile`);

    await page.locator('#name').fill('');
    await page.getByRole('button', { name: /名前を更新/ }).click();

    await expect(page.getByText('名前を入力してください')).toBeVisible();
  });

  test('プロフィールページ → パスワード変更が成功する', async ({ page }) => {
    await uiLogin(page, MEMBER.email, PASSWORD);
    await page.goto(`${DOMAINS.APP}/profile`);

    // 同じパスワードに変更（テスト用）
    await page.locator('#password').fill(PASSWORD);
    await page.locator('#confirmPassword').fill(PASSWORD);
    await page.getByRole('button', { name: /パスワードを更新/ }).click();

    // パスワード変更成功後、セッションが無効化されログインページへリダイレクト
    // または成功メッセージが表示される（どちらも成功を意味する）
    await expect(
      page.getByText('パスワードを更新しました').or(page.getByRole('heading', { name: 'サインイン' }))
    ).toBeVisible({ timeout: 15000 });
  });

  test('プロフィールページ → パスワード不一致でエラー表示', async ({ page }) => {
    await uiLogin(page, MEMBER.email, PASSWORD);
    await page.goto(`${DOMAINS.APP}/profile`);

    await page.locator('#password').fill('newpassword123');
    await page.locator('#confirmPassword').fill('differentpassword');
    await page.getByRole('button', { name: /パスワードを更新/ }).click();

    await expect(page.getByText('パスワードが一致しません')).toBeVisible();
  });

  test('プロフィールページ → パスワード6文字未満でエラー表示', async ({ page }) => {
    await uiLogin(page, MEMBER.email, PASSWORD);
    await page.goto(`${DOMAINS.APP}/profile`);

    await page.locator('#password').fill('12345');
    await page.locator('#confirmPassword').fill('12345');
    await page.getByRole('button', { name: /パスワードを更新/ }).click();

    await expect(page.getByText('パスワードは6文字以上で入力してください')).toBeVisible();
  });

  test('ナビゲーション → プロフィールリンクが表示される', async ({ page }) => {
    await uiLogin(page, MEMBER.email, PASSWORD);
    await page.goto(`${DOMAINS.APP}/dashboard`);

    await expect(page.getByRole('link', { name: 'プロフィール' })).toBeVisible();
  });

  test('ナビゲーション → プロフィールリンクからプロフィールページへ遷移', async ({ page }) => {
    await uiLogin(page, MEMBER.email, PASSWORD);
    await page.goto(`${DOMAINS.APP}/dashboard`);

    await page.getByRole('link', { name: 'プロフィール' }).click();

    await expect(page).toHaveURL(new RegExp(`${DOMAINS.APP}/profile`));
  });
});
