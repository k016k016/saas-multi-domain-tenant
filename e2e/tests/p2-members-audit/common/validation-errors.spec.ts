import { test, expect } from '@playwright/test';
import { DOMAINS } from '../../../helpers/domains';
import { uiLogin } from '../../../helpers/auth';

const OWNER = { email: 'owner1@example.com' };
const PASSWORD = process.env.E2E_TEST_PASSWORD!;

test.describe('バリデーションエラー', () => {
  test.beforeEach(async ({ page }) => {
    await uiLogin(page, OWNER.email, PASSWORD);
  });

  test.describe('メンバー招待フォーム', () => {
    test('無効なメールアドレス形式 → エラー表示', async ({ page }) => {
      await page.goto(`${DOMAINS.ADMIN}/members`);
      await expect(page.getByRole('heading', { name: /members/i })).toBeVisible();

      // ユーザー追加ボタンをクリック
      await page.getByRole('button', { name: /ユーザーを追加/i }).click();

      // モーダルが開くのを待つ
      await expect(page.getByRole('heading', { name: /新規ユーザーを招待/i })).toBeVisible();

      // 無効なメールアドレスを入力（モーダル内のID）
      await page.locator('#invite-name').fill('Test User');
      await page.locator('#invite-email').fill('invalid-email');
      await page.locator('#invite-password').fill('password123');
      await page.locator('#invite-password-confirm').fill('password123');

      // HTML5のtype="email"バリデーションでブロックされる
      // 送信ボタンをクリック
      await page.getByRole('button', { name: /^追加$/ }).click();

      // HTML5バリデーションでブロックされるか、Server Actionエラー
      const emailInput = page.locator('#invite-email');
      const isInvalid = await emailInput.evaluate((el: HTMLInputElement) => !el.validity.valid);
      expect(isInvalid).toBe(true);
    });

    test('短すぎるパスワード → エラー表示', async ({ page }) => {
      await page.goto(`${DOMAINS.ADMIN}/members`);
      await expect(page.getByRole('heading', { name: /members/i })).toBeVisible();

      await page.getByRole('button', { name: /ユーザーを追加/i }).click();
      await expect(page.getByRole('heading', { name: /新規ユーザーを招待/i })).toBeVisible();

      await page.locator('#invite-name').fill('Test User');
      await page.locator('#invite-email').fill('newuser@example.com');
      await page.locator('#invite-password').fill('short');
      await page.locator('#invite-password-confirm').fill('short');

      await page.getByRole('button', { name: /^追加$/ }).click();

      // Server Actionからのエラー
      await expect(page.getByText(/6文字以上/i)).toBeVisible();
    });

    test('パスワード不一致 → エラー表示', async ({ page }) => {
      await page.goto(`${DOMAINS.ADMIN}/members`);
      await expect(page.getByRole('heading', { name: /members/i })).toBeVisible();

      await page.getByRole('button', { name: /ユーザーを追加/i }).click();
      await expect(page.getByRole('heading', { name: /新規ユーザーを招待/i })).toBeVisible();

      await page.locator('#invite-name').fill('Test User');
      await page.locator('#invite-email').fill('newuser@example.com');
      await page.locator('#invite-password').fill('password123');
      await page.locator('#invite-password-confirm').fill('differentpass');

      await page.getByRole('button', { name: /^追加$/ }).click();

      // クライアント側のパスワード一致エラー
      await expect(page.getByText(/パスワードが一致しません/i)).toBeVisible();
    });
  });

  test.describe('プロフィール編集フォーム（app）', () => {
    test('空の表示名 → エラー表示', async ({ page }) => {
      await page.goto(`${DOMAINS.APP}/profile`);
      await expect(page.getByText('プロフィール編集')).toBeVisible();

      // 表示名を空にする
      const nameInput = page.locator('#name');
      await nameInput.fill('');

      // 保存ボタンをクリック
      await page.getByRole('button', { name: /名前を更新/i }).click();

      // エラーが表示される
      await expect(page.getByText(/名前を入力してください/i)).toBeVisible();
    });

    test('パスワード不一致 → エラー表示', async ({ page }) => {
      await page.goto(`${DOMAINS.APP}/profile`);
      await expect(page.getByText('プロフィール編集')).toBeVisible();

      // パスワード変更セクション
      await page.locator('#password').fill('NewPassword123!');
      await page.locator('#confirmPassword').fill('DifferentPassword!');

      // パスワード更新ボタンをクリック
      await page.getByRole('button', { name: /パスワードを更新/i }).click();

      // 不一致エラー
      await expect(page.getByText(/パスワードが一致しません/i)).toBeVisible();
    });
  });
});
