import { test, expect } from '@playwright/test';
import { DOMAINS } from '../../helpers/domains';
import { uiLogin } from '../../helpers/auth';
import { getSupabaseAdmin } from '@repo/db';

const OPS_USER = { email: 'ops1@example.com' };
const PASSWORD = process.env.E2E_TEST_PASSWORD!;
const TEST_ORG_ID = '00000000-0000-0000-0000-000000000001'; // Test Organization

test.describe('ops/orgs/[orgId] - メンバー管理', () => {
  // 各テスト後にゴミユーザーをクリーンアップ
  test.afterEach(async () => {
    const supabaseAdmin = getSupabaseAdmin();
    const { data: { users } } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });

    // ops-test-数字@example.com, ops-delete-test-数字@example.com パターンを削除
    const garbageUsers = users?.filter(u =>
      u.email && /^ops-(test|delete-test)-\d+@example\.com$/.test(u.email)
    ) || [];

    for (const user of garbageUsers) {
      await supabaseAdmin.from('profiles').delete().eq('user_id', user.id);
      await supabaseAdmin.from('user_org_context').delete().eq('user_id', user.id);
      await supabaseAdmin.auth.admin.deleteUser(user.id);
    }
  });
  test('ops → 組織詳細ページにアクセス可能', async ({ page }) => {
    await uiLogin(page, OPS_USER.email, PASSWORD);
    await page.goto(`${DOMAINS.OPS}/orgs/${TEST_ORG_ID}`);

    await expect(page.getByRole('heading', { name: /組織メンバー管理/i })).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();
  });

  test('ops → メンバー一覧にテーブル行が表示される', async ({ page }) => {
    await uiLogin(page, OPS_USER.email, PASSWORD);
    await page.goto(`${DOMAINS.OPS}/orgs/${TEST_ORG_ID}`);

    // メンバー一覧テーブルが表示される
    await expect(page.getByRole('table')).toBeVisible();
    // 最低1人のメンバーが表示される
    const rows = page.locator('table tbody tr');
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('ops → 組織一覧に戻るリンクが機能する', async ({ page }) => {
    await uiLogin(page, OPS_USER.email, PASSWORD);
    await page.goto(`${DOMAINS.OPS}/orgs/${TEST_ORG_ID}`);

    // 戻るリンクをクリック
    await page.getByRole('link', { name: /組織一覧に戻る/i }).click();

    // 組織一覧ページに遷移
    await expect(page).toHaveURL(`${DOMAINS.OPS}/orgs`);
  });

  test('ops → 招待モーダルが開く', async ({ page }) => {
    await uiLogin(page, OPS_USER.email, PASSWORD);
    await page.goto(`${DOMAINS.OPS}/orgs/${TEST_ORG_ID}`);

    // ユーザーを追加ボタンをクリック
    await page.getByRole('button', { name: /ユーザーを追加/i }).click();

    // モーダルが表示される
    await expect(page.getByRole('heading', { name: /新規ユーザーを招待/i })).toBeVisible();
    await expect(page.locator('input#invite-name')).toBeVisible();
    await expect(page.locator('input#invite-email')).toBeVisible();
    await expect(page.locator('input#invite-password')).toBeVisible();
    await expect(page.locator('input#invite-password-confirm')).toBeVisible();
    await expect(page.locator('select#invite-role')).toBeVisible();
  });

  test('ops → 編集・削除ボタンが表示される', async ({ page }) => {
    await uiLogin(page, OPS_USER.email, PASSWORD);
    await page.goto(`${DOMAINS.OPS}/orgs/${TEST_ORG_ID}`);

    await expect(page.getByRole('button', { name: /編集/i }).first()).toBeVisible();
    // 削除ボタンはownerでない行に表示される（全てがownerでなければ）
    const deleteButtons = page.getByRole('button', { name: /削除/i });
    const deleteCount = await deleteButtons.count();
    // owner以外のメンバーがいれば削除ボタンが表示される
    if (deleteCount > 0) {
      await expect(deleteButtons.first()).toBeVisible();
    }
  });

  test('ops → 編集モーダルが開く', async ({ page }) => {
    await uiLogin(page, OPS_USER.email, PASSWORD);
    await page.goto(`${DOMAINS.OPS}/orgs/${TEST_ORG_ID}`);

    // 編集ボタンをクリック
    await page.getByRole('button', { name: /編集/i }).first().click();

    // モーダルが表示される
    await expect(page.getByRole('heading', { name: /ユーザー情報を編集/i })).toBeVisible();
    await expect(page.locator('input#edit-name')).toBeVisible();
    await expect(page.locator('input#edit-email')).toBeVisible();
    await expect(page.locator('select#edit-role')).toBeVisible();
  });

  test('ops → ユーザー追加が成功する', async ({ page }) => {
    await uiLogin(page, OPS_USER.email, PASSWORD);
    await page.goto(`${DOMAINS.OPS}/orgs/${TEST_ORG_ID}`);

    // ユニークなメールアドレスを生成
    const uniqueEmail = `ops-test-${Date.now()}@example.com`;

    // ユーザーを追加ボタンをクリック
    await page.getByRole('button', { name: /ユーザーを追加/i }).click();

    // モーダルに入力
    await page.locator('input#invite-name').fill('OPSテストユーザー');
    await page.locator('input#invite-email').fill(uniqueEmail);
    await page.locator('input#invite-password').fill(PASSWORD);
    await page.locator('input#invite-password-confirm').fill(PASSWORD);
    await page.locator('select#invite-role').selectOption('member');

    // 追加ボタンをクリック
    await page.getByRole('button', { name: /^追加$/i }).click();

    // モーダルが閉じる
    await expect(page.getByRole('heading', { name: /新規ユーザーを招待/i })).not.toBeVisible();

    // 成功メッセージが表示される
    await expect(page.getByText(/ユーザーを追加しました/i)).toBeVisible();

    // 一覧に新しいユーザーが表示される
    await expect(page.getByText(uniqueEmail)).toBeVisible();
  });

  test('ops → ユーザー編集（氏名変更）が成功する', async ({ page }) => {
    await uiLogin(page, OPS_USER.email, PASSWORD);
    await page.goto(`${DOMAINS.OPS}/orgs/${TEST_ORG_ID}`);

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

    // 成功メッセージが表示される
    await expect(page.getByText(/ユーザー情報を更新しました/i)).toBeVisible();

    // 一覧に変更が反映される
    await expect(page.getByText(newName)).toBeVisible();
  });

  test('ops → ユーザー削除が成功する', async ({ page }) => {
    await uiLogin(page, OPS_USER.email, PASSWORD);
    await page.goto(`${DOMAINS.OPS}/orgs/${TEST_ORG_ID}`);

    // まず新しいユーザーを追加
    const uniqueEmail = `ops-delete-test-${Date.now()}@example.com`;

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

    // 成功メッセージが表示される
    await expect(page.getByText(/ユーザーを削除しました/i)).toBeVisible();

    // 一覧から削除される
    await expect(page.getByText(uniqueEmail)).not.toBeVisible();
  });

  test('ops → ownerの削除ボタンは非表示', async ({ page }) => {
    await uiLogin(page, OPS_USER.email, PASSWORD);
    await page.goto(`${DOMAINS.OPS}/orgs/${TEST_ORG_ID}`);

    // owner行を探す（owner1@example.com）
    const ownerRow = page.locator('tr', { hasText: 'owner1@example.com' });
    await expect(ownerRow).toBeVisible();

    // 削除ボタンが存在しないことを確認
    const deleteBtn = ownerRow.getByRole('button', { name: /削除/i });
    await expect(deleteBtn).not.toBeVisible();
  });

  test('ops → ownerの編集でロール変更不可', async ({ page }) => {
    await uiLogin(page, OPS_USER.email, PASSWORD);
    await page.goto(`${DOMAINS.OPS}/orgs/${TEST_ORG_ID}`);

    // owner行を探す
    const ownerRow = page.locator('tr', { hasText: 'owner1@example.com' });
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

  test('ops → パスワード不一致でエラー表示（招待時）', async ({ page }) => {
    await uiLogin(page, OPS_USER.email, PASSWORD);
    await page.goto(`${DOMAINS.OPS}/orgs/${TEST_ORG_ID}`);

    await page.getByRole('button', { name: /ユーザーを追加/i }).click();

    await page.locator('input#invite-name').fill('テストユーザー');
    await page.locator('input#invite-email').fill(`test-${Date.now()}@example.com`);
    await page.locator('input#invite-password').fill('Password1');
    await page.locator('input#invite-password-confirm').fill('Password2');
    await page.locator('select#invite-role').selectOption('member');

    await page.getByRole('button', { name: /^追加$/i }).click();

    // エラーメッセージが表示される
    await expect(page.getByText(/パスワードが一致しません/i)).toBeVisible();
  });

  test('ops → パスワード不一致でエラー表示（編集時）', async ({ page }) => {
    await uiLogin(page, OPS_USER.email, PASSWORD);
    await page.goto(`${DOMAINS.OPS}/orgs/${TEST_ORG_ID}`);

    // 編集ボタンをクリック
    await page.getByRole('button', { name: /編集/i }).first().click();

    // パスワードを不一致で入力
    await page.locator('input#edit-password').fill('Password1');
    await page.locator('input#edit-password-confirm').fill('Password2');

    await page.getByRole('button', { name: /保存/i }).click();

    // エラーメッセージが表示される
    await expect(page.getByText(/パスワードが一致しません/i)).toBeVisible();
  });

  test('ops → キャンセルボタンでモーダルが閉じる（招待）', async ({ page }) => {
    await uiLogin(page, OPS_USER.email, PASSWORD);
    await page.goto(`${DOMAINS.OPS}/orgs/${TEST_ORG_ID}`);

    await page.getByRole('button', { name: /ユーザーを追加/i }).click();
    await expect(page.getByRole('heading', { name: /新規ユーザーを招待/i })).toBeVisible();

    await page.getByRole('button', { name: /キャンセル/i }).click();

    await expect(page.getByRole('heading', { name: /新規ユーザーを招待/i })).not.toBeVisible();
  });

  test('ops → キャンセルボタンでモーダルが閉じる（編集）', async ({ page }) => {
    await uiLogin(page, OPS_USER.email, PASSWORD);
    await page.goto(`${DOMAINS.OPS}/orgs/${TEST_ORG_ID}`);

    await page.getByRole('button', { name: /編集/i }).first().click();
    await expect(page.getByRole('heading', { name: /ユーザー情報を編集/i })).toBeVisible();

    await page.getByRole('button', { name: /キャンセル/i }).click();

    await expect(page.getByRole('heading', { name: /ユーザー情報を編集/i })).not.toBeVisible();
  });
});
