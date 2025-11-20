import { test, expect } from '@playwright/test';
import { DOMAINS } from '../../../helpers/domains';
import { uiLogin } from '../../../helpers/auth';
import { resetUserToOrg1, createTestUser, deleteTestUser, resetUserPassword } from '../../../helpers/db';

const ADMIN = { email: 'admin1@example.com' };
const OWNER = { email: 'owner1@example.com' };
const MEMBER = { email: 'member1@example.com' };
const PASSWORD = process.env.E2E_TEST_PASSWORD!;

// テスト用ユーザー
const TEST_USER = {
  email: `test-${Date.now()}@example.com`,
  name: 'テストユーザー',
  password: PASSWORD,
};

test.describe('admin/members CRUD', () => {
  // 各テスト前にmember1をorg1（member権限）にリセット
  test.beforeEach(async () => {
    await resetUserToOrg1(MEMBER.email);
  });
  test('admin → メンバー一覧にアクセス可能', async ({ page }) => {
    await uiLogin(page, ADMIN.email, PASSWORD);
    await page.goto(`${DOMAINS.ADMIN}/members`);

    await expect(page.getByRole('heading', { name: /メンバー管理/i })).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();
  });

  test('owner → メンバー一覧にアクセス可能', async ({ page }) => {
    await uiLogin(page, OWNER.email, PASSWORD);
    await page.goto(`${DOMAINS.ADMIN}/members`);

    await expect(page.getByRole('heading', { name: /メンバー管理/i })).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();
  });

  test('member → メンバー一覧にアクセス不可（/unauthorizedへリダイレクト）', async ({ page }) => {
    await uiLogin(page, MEMBER.email, PASSWORD);
    await page.goto(`${DOMAINS.ADMIN}/members`);

    // UX改善: 権限エラー時は専用の/unauthorizedページにリダイレクト
    await expect(page).toHaveURL(new RegExp(`${DOMAINS.ADMIN}/unauthorized`));
  });

  test('admin → 招待モーダルが開く', async ({ page }) => {
    await uiLogin(page, ADMIN.email, PASSWORD);
    await page.goto(`${DOMAINS.ADMIN}/members`);

    // 「ユーザーを追加」ボタンをクリック
    await page.getByRole('button', { name: /ユーザーを追加/i }).click();

    // モーダルが表示される
    await expect(page.getByRole('heading', { name: /新規ユーザーを招待/i })).toBeVisible();
    await expect(page.locator('input#invite-name')).toBeVisible();
    await expect(page.locator('input#invite-email')).toBeVisible();
    await expect(page.locator('input#invite-password')).toBeVisible();
    await expect(page.locator('input#invite-password-confirm')).toBeVisible();
    await expect(page.locator('select#invite-role')).toBeVisible();
  });

  test('admin → メンバー一覧にテーブル行が表示される', async ({ page }) => {
    await uiLogin(page, ADMIN.email, PASSWORD);
    await page.goto(`${DOMAINS.ADMIN}/members`);

    // メンバー一覧テーブルが表示される
    await expect(page.getByRole('table')).toBeVisible();
    // 最低1人（admin1）がメンバー一覧に表示される
    const rows = page.locator('table tbody tr');
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('admin → 編集・削除ボタンが表示される', async ({ page }) => {
    await uiLogin(page, ADMIN.email, PASSWORD);
    await page.goto(`${DOMAINS.ADMIN}/members`);

    await expect(page.getByRole('button', { name: /編集/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /削除/i }).first()).toBeVisible();
  });

  test('admin → 編集モーダルが開く', async ({ page }) => {
    await uiLogin(page, ADMIN.email, PASSWORD);
    await page.goto(`${DOMAINS.ADMIN}/members`);

    // 編集ボタンをクリック
    await page.getByRole('button', { name: /編集/i }).first().click();

    // モーダルが表示される
    await expect(page.getByRole('heading', { name: /ユーザー情報を編集/i })).toBeVisible();
    await expect(page.locator('input#edit-name')).toBeVisible();
    await expect(page.locator('input#edit-email')).toBeVisible();
    await expect(page.locator('select#edit-role')).toBeVisible();
  });

  test('admin → ユーザー追加が成功する', async ({ page }) => {
    await uiLogin(page, ADMIN.email, PASSWORD);
    await page.goto(`${DOMAINS.ADMIN}/members`);

    // ユニークなメールアドレスを生成
    const uniqueEmail = `test-${Date.now()}@example.com`;

    // 「ユーザーを追加」ボタンをクリック
    await page.getByRole('button', { name: /ユーザーを追加/i }).click();

    // モーダルに入力
    await page.locator('input#invite-name').fill('新規テストユーザー');
    await page.locator('input#invite-email').fill(uniqueEmail);
    await page.locator('input#invite-password').fill(PASSWORD);
    await page.locator('input#invite-password-confirm').fill(PASSWORD);
    await page.locator('select#invite-role').selectOption('member');

    // 追加ボタンをクリック
    await page.getByRole('button', { name: /^追加$/i }).click();

    // モーダルが閉じる
    await expect(page.getByRole('heading', { name: /新規ユーザーを招待/i })).not.toBeVisible();

    // 一覧に新しいユーザーが表示される
    await expect(page.getByText(uniqueEmail)).toBeVisible();
  });

  test('admin → ユーザー編集が成功する', async ({ page }) => {
    await uiLogin(page, ADMIN.email, PASSWORD);
    await page.goto(`${DOMAINS.ADMIN}/members`);

    // 最初の編集ボタンをクリック
    await page.getByRole('button', { name: /編集/i }).first().click();

    // モーダルが表示される
    await expect(page.getByRole('heading', { name: /ユーザー情報を編集/i })).toBeVisible();

    // 氏名を変更
    const newName = `編集済み-${Date.now()}`;
    await page.locator('input#edit-name').fill(newName);

    // 保存ボタンをクリック
    await page.getByRole('button', { name: /保存/i }).click();

    // モーダルが閉じる
    await expect(page.getByRole('heading', { name: /ユーザー情報を編集/i })).not.toBeVisible();

    // 一覧に変更が反映される
    await expect(page.getByText(newName)).toBeVisible();
  });

  test('admin → ユーザー削除が成功する', async ({ page }) => {
    await uiLogin(page, ADMIN.email, PASSWORD);
    await page.goto(`${DOMAINS.ADMIN}/members`);

    // まず新しいユーザーを追加
    const uniqueEmail = `delete-test-${Date.now()}@example.com`;

    // 「ユーザーを追加」ボタンをクリック
    await page.getByRole('button', { name: /ユーザーを追加/i }).click();

    await page.locator('input#invite-name').fill('削除テストユーザー');
    await page.locator('input#invite-email').fill(uniqueEmail);
    await page.locator('input#invite-password').fill(PASSWORD);
    await page.locator('input#invite-password-confirm').fill(PASSWORD);
    await page.locator('select#invite-role').selectOption('member');
    await page.getByRole('button', { name: /^追加$/i }).click();

    // モーダルが閉じる
    await expect(page.getByRole('heading', { name: /新規ユーザーを招待/i })).not.toBeVisible();

    // 追加されたことを確認
    await expect(page.getByText(uniqueEmail)).toBeVisible();

    // 削除ダイアログをacceptするように設定
    page.on('dialog', dialog => dialog.accept());

    // 追加したユーザーの削除ボタンをクリック
    const row = page.locator('tr', { hasText: uniqueEmail });
    await row.getByRole('button', { name: /削除/i }).click();

    // 一覧から削除される
    await expect(page.getByText(uniqueEmail)).not.toBeVisible();
  });

  // Owner保護テスト
  test('admin → ownerの削除ボタンは非表示', async ({ page }) => {
    await uiLogin(page, ADMIN.email, PASSWORD);
    await page.goto(`${DOMAINS.ADMIN}/members`);

    // owner行を探す
    const ownerRow = page.locator('tr', { hasText: OWNER.email });
    await expect(ownerRow).toBeVisible();

    // 削除ボタンが存在しないことを確認
    const deleteBtn = ownerRow.getByRole('button', { name: /削除/i });
    await expect(deleteBtn).not.toBeVisible();
  });

  test('admin → ownerの編集でロール変更不可', async ({ page }) => {
    await uiLogin(page, ADMIN.email, PASSWORD);
    await page.goto(`${DOMAINS.ADMIN}/members`);

    // owner行を探す
    const ownerRow = page.locator('tr', { hasText: OWNER.email });
    await expect(ownerRow).toBeVisible();

    // 編集ボタンをクリック
    await ownerRow.getByRole('button', { name: /編集/i }).click();

    // モーダルが表示される
    await expect(page.getByRole('heading', { name: /ユーザー情報を編集/i })).toBeVisible();

    // ロールセレクトが無効化されていることを確認
    const roleSelect = page.locator('select#edit-role');
    await expect(roleSelect).toBeDisabled();

    // 注意書きが表示されていることを確認
    await expect(page.getByText(/Ownerのロールは変更できません/i)).toBeVisible();
  });

  test('admin → ownerの氏名変更が成功する', async ({ page }) => {
    await uiLogin(page, ADMIN.email, PASSWORD);
    await page.goto(`${DOMAINS.ADMIN}/members`);

    // owner行を探す
    const ownerRow = page.locator('tr', { hasText: OWNER.email });
    await expect(ownerRow).toBeVisible();

    // 編集ボタンをクリック
    await ownerRow.getByRole('button', { name: /編集/i }).click();

    // モーダルが表示される
    await expect(page.getByRole('heading', { name: /ユーザー情報を編集/i })).toBeVisible();

    // 氏名を変更
    const newName = `オーナー-${Date.now()}`;
    await page.locator('input#edit-name').fill(newName);

    // 保存ボタンをクリック
    await page.getByRole('button', { name: /保存/i }).click();

    // モーダルが閉じる
    await expect(page.getByRole('heading', { name: /ユーザー情報を編集/i })).not.toBeVisible();

    // 一覧に変更が反映される
    await expect(page.getByText(newName)).toBeVisible();
  });

  test('admin → 編集モーダルでロール変更が反映される', async ({ page }) => {
    await uiLogin(page, ADMIN.email, PASSWORD);
    await page.goto(`${DOMAINS.ADMIN}/members`);

    // member1の編集ボタンをクリック
    const memberRow = page.locator('tr', { hasText: MEMBER.email });
    await memberRow.getByRole('button', { name: /編集/i }).click();

    // モーダルが表示される
    await expect(page.getByRole('heading', { name: /ユーザー情報を編集/i })).toBeVisible();

    // ロールをadminに変更
    await page.locator('select#edit-role').selectOption('admin');

    // 保存
    await page.getByRole('button', { name: /保存/i }).click();

    // モーダルが閉じる
    await expect(page.getByRole('heading', { name: /ユーザー情報を編集/i })).not.toBeVisible();

    // 一覧でロールが更新されていることを確認（ロール列にadminが表示）
    const updatedRow = page.locator('tr', { hasText: MEMBER.email });
    await expect(updatedRow.getByText('admin')).toBeVisible();
  });

  test('admin → パスワード変更が成功し、新パスワードでログイン可能', async ({ page }) => {
    const NEW_PASSWORD = 'NewPassword123!';

    try {
      await uiLogin(page, ADMIN.email, PASSWORD);
      await page.goto(`${DOMAINS.ADMIN}/members`);

      // member1の編集ボタンをクリック
      const memberRow = page.locator('tr', { hasText: MEMBER.email });
      await memberRow.getByRole('button', { name: /編集/i }).click();

      // モーダルが表示される
      await expect(page.getByRole('heading', { name: /ユーザー情報を編集/i })).toBeVisible();

      // パスワードを変更
      await page.locator('input#edit-password').fill(NEW_PASSWORD);
      await page.locator('input#edit-password-confirm').fill(NEW_PASSWORD);

      // 保存
      await page.getByRole('button', { name: /保存/i }).click();

      // モーダルが閉じる
      await expect(page.getByRole('heading', { name: /ユーザー情報を編集/i })).not.toBeVisible();

      // Cookieをクリアして新しいセッションでログイン確認
      await page.context().clearCookies();

      // ログインページへ遷移
      await page.goto(`${DOMAINS.WWW}/login`);
      await page.locator('#email').fill(MEMBER.email);
      await page.locator('#password').fill(NEW_PASSWORD);
      await page.getByRole('button', { name: /sign in|login|サインイン/i }).click();

      // ログイン成功（ダッシュボードにリダイレクト）
      await expect(page).toHaveURL(new RegExp(`${DOMAINS.APP}`));
    } finally {
      // パスワードを元に戻す
      await resetUserPassword(MEMBER.email, PASSWORD);
    }
  });

  test('admin → パスワード不一致でエラー表示', async ({ page }) => {
    await uiLogin(page, ADMIN.email, PASSWORD);
    await page.goto(`${DOMAINS.ADMIN}/members`);

    // member1の編集ボタンをクリック
    const memberRow = page.locator('tr', { hasText: MEMBER.email });
    await memberRow.getByRole('button', { name: /編集/i }).click();

    // モーダルが表示される
    await expect(page.getByRole('heading', { name: /ユーザー情報を編集/i })).toBeVisible();

    // パスワードを不一致で入力
    await page.locator('input#edit-password').fill('Password1');
    await page.locator('input#edit-password-confirm').fill('Password2');

    // 保存
    await page.getByRole('button', { name: /保存/i }).click();

    // エラーメッセージ
    await expect(page.getByText(/パスワードが一致しません/i)).toBeVisible();
  });

  test('admin → 招待時にパスワード不一致でエラー表示', async ({ page }) => {
    await uiLogin(page, ADMIN.email, PASSWORD);
    await page.goto(`${DOMAINS.ADMIN}/members`);

    // 「ユーザーを追加」ボタンをクリック
    await page.getByRole('button', { name: /ユーザーを追加/i }).click();

    // モーダルに入力
    await page.locator('input#invite-name').fill('テストユーザー');
    await page.locator('input#invite-email').fill(`test-${Date.now()}@example.com`);
    await page.locator('input#invite-password').fill('Password1');
    await page.locator('input#invite-password-confirm').fill('Password2');
    await page.locator('select#invite-role').selectOption('member');

    // 追加ボタンをクリック
    await page.getByRole('button', { name: /^追加$/i }).click();

    // エラーメッセージ
    await expect(page.getByText(/パスワードが一致しません/i)).toBeVisible();
  });

  test('admin → サインアウトでログインページへ遷移', async ({ page }) => {
    await uiLogin(page, ADMIN.email, PASSWORD);
    await page.goto(`${DOMAINS.ADMIN}/members`);

    // サインアウトボタンをクリック
    await page.getByRole('button', { name: /サインアウト/i }).click();

    // ログインページへリダイレクト（wwwまたはappドメイン）
    await expect(page).toHaveURL(new RegExp(`(${DOMAINS.WWW}/login|${DOMAINS.APP})`));
  });

});
