import { test, expect } from '@playwright/test';
import { DOMAINS } from '../../helpers/domains';
import { uiLogin } from '../../helpers/auth';
import { createTestOrganization, deleteTestOrganization, getSupabaseAdmin } from '../../helpers/db';

const OPS_USER = { email: 'ops1@example.com' };
const PASSWORD = process.env.E2E_TEST_PASSWORD!;

test.describe('ops/orgs CRUD', () => {
  // 各テスト後にゴミ組織をクリーンアップ（try/finallyでカバーできない場合のセーフティネット）
  test.afterEach(async () => {
    const supabaseAdmin = getSupabaseAdmin();

    // テストで作成された組織パターンを削除
    const patterns = [
      'edit-name-test-%',
      'plan-change-test-%',
      'active-toggle-test-%',
      'delete-test-%',
      'slug-edit-test-%',
      'edited-slug-%',
    ];

    for (const pattern of patterns) {
      const { data: orgs } = await supabaseAdmin
        .from('organizations')
        .select('id')
        .like('slug', pattern);

      for (const org of orgs || []) {
        await supabaseAdmin.from('profiles').delete().eq('org_id', org.id);
        await supabaseAdmin.from('organizations').delete().eq('id', org.id);
      }
    }
  });
  test('ops → 組織一覧にアクセス可能', async ({ page }) => {
    await uiLogin(page, OPS_USER.email, PASSWORD);
    await page.goto(`${DOMAINS.OPS}/orgs`);

    await expect(page.getByRole('heading', { name: /組織一覧/i })).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();
  });

  test('ops → 組織一覧にテーブル行が表示される', async ({ page }) => {
    await uiLogin(page, OPS_USER.email, PASSWORD);
    await page.goto(`${DOMAINS.OPS}/orgs`);

    // 組織一覧テーブルが表示される
    await expect(page.getByRole('table')).toBeVisible();
    // 最低1つの組織が表示される
    const rows = page.locator('table tbody tr');
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('ops → 編集・削除ボタンが表示される', async ({ page }) => {
    await uiLogin(page, OPS_USER.email, PASSWORD);
    await page.goto(`${DOMAINS.OPS}/orgs`);

    await expect(page.getByRole('button', { name: /編集/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /削除/i }).first()).toBeVisible();
  });

  test('ops → 編集モーダルが開く', async ({ page }) => {
    await uiLogin(page, OPS_USER.email, PASSWORD);
    await page.goto(`${DOMAINS.OPS}/orgs`);

    // 編集ボタンをクリック
    await page.getByRole('button', { name: /編集/i }).first().click();

    // モーダルが表示される
    await expect(page.getByRole('heading', { name: /組織を編集/i })).toBeVisible();
    await expect(page.locator('input#name')).toBeVisible();
    await expect(page.locator('input#slug')).toBeVisible();
    await expect(page.locator('select#plan')).toBeVisible();
  });

  test('ops → 組織名の編集が成功する', async ({ page }) => {
    await uiLogin(page, OPS_USER.email, PASSWORD);

    // テスト用組織を作成
    const originalName = `編集前組織-${Date.now()}`;
    const testOrgSlug = `edit-name-test-${Date.now()}`;
    const testOrgId = await createTestOrganization(originalName, testOrgSlug);

    try {
      await page.goto(`${DOMAINS.OPS}/orgs`);

      // 作成した組織の編集ボタンをクリック
      const row = page.locator('tr', { hasText: originalName });
      await row.getByRole('button', { name: /編集/i }).click();

      // モーダルが表示される
      await expect(page.getByRole('heading', { name: /組織を編集/i })).toBeVisible();

      // 組織名を変更
      const newName = `編集済み組織-${Date.now()}`;
      await page.locator('input#name').fill(newName);

      // 更新ボタンをクリック
      await page.getByRole('button', { name: /更新/i }).click();

      // モーダルが閉じる
      await expect(page.getByRole('heading', { name: /組織を編集/i })).not.toBeVisible();

      // 成功メッセージが表示される
      await expect(page.getByText(/組織を更新しました/i)).toBeVisible();

      // 一覧に変更が反映される
      await expect(page.getByText(newName)).toBeVisible();
    } finally {
      await deleteTestOrganization(testOrgId);
    }
  });

  test('ops → プラン変更が成功する', async ({ page }) => {
    await uiLogin(page, OPS_USER.email, PASSWORD);

    // テスト用組織を作成
    const testOrgName = `プラン変更テスト-${Date.now()}`;
    const testOrgSlug = `plan-change-test-${Date.now()}`;
    const testOrgId = await createTestOrganization(testOrgName, testOrgSlug);

    try {
      await page.goto(`${DOMAINS.OPS}/orgs`);

      // 作成した組織の編集ボタンをクリック
      const row = page.locator('tr', { hasText: testOrgName });
      await row.getByRole('button', { name: /編集/i }).click();

      // モーダルが表示される
      await expect(page.getByRole('heading', { name: /組織を編集/i })).toBeVisible();

      // プランを変更
      await page.locator('select#plan').selectOption('business');

      // 更新ボタンをクリック
      await page.getByRole('button', { name: /更新/i }).click();

      // モーダルが閉じる
      await expect(page.getByRole('heading', { name: /組織を編集/i })).not.toBeVisible();

      // 成功メッセージが表示される
      await expect(page.getByText(/組織を更新しました/i)).toBeVisible();

      // 一覧にbusinessが表示される
      await expect(row.getByText('business')).toBeVisible();
    } finally {
      await deleteTestOrganization(testOrgId);
    }
  });

  test('ops → 組織の有効/無効の切り替えが成功する', async ({ page }) => {
    await uiLogin(page, OPS_USER.email, PASSWORD);

    // テスト用組織を作成
    const testOrgName = `有効無効テスト-${Date.now()}`;
    const testOrgSlug = `active-toggle-test-${Date.now()}`;
    const testOrgId = await createTestOrganization(testOrgName, testOrgSlug);

    try {
      await page.goto(`${DOMAINS.OPS}/orgs`);

      // 作成した組織の編集ボタンをクリック
      const row = page.locator('tr', { hasText: testOrgName });
      await row.getByRole('button', { name: /編集/i }).click();

      // モーダルが表示される
      await expect(page.getByRole('heading', { name: /組織を編集/i })).toBeVisible();

      // 有効化チェックボックスの状態を反転（初期状態はtrue）
      const checkbox = page.locator('input[type="checkbox"]');
      await checkbox.uncheck();

      // 更新ボタンをクリック
      await page.getByRole('button', { name: /更新/i }).click();

      // モーダルが閉じる
      await expect(page.getByRole('heading', { name: /組織を編集/i })).not.toBeVisible();

      // 成功メッセージが表示される
      await expect(page.getByText(/組織を更新しました/i)).toBeVisible();

      // 一覧にステータスが表示される（spanタグの「無効」を探す）
      await expect(row.locator('span', { hasText: '無効' })).toBeVisible();
    } finally {
      await deleteTestOrganization(testOrgId);
    }
  });

  test('ops → 組織削除が成功する（メンバー0人の場合）', async ({ page }) => {
    await uiLogin(page, OPS_USER.email, PASSWORD);

    // テスト用組織を作成（メンバー0人）
    const testOrgName = `削除テスト組織-${Date.now()}`;
    const testOrgSlug = `delete-test-${Date.now()}`;
    const testOrgId = await createTestOrganization(testOrgName, testOrgSlug);

    await page.goto(`${DOMAINS.OPS}/orgs`);

    // 追加されたことを確認
    await expect(page.getByText(testOrgName)).toBeVisible();

    // 削除ダイアログをacceptするように設定
    page.on('dialog', dialog => dialog.accept());

    // 削除ボタンをクリック
    const row = page.locator('tr', { hasText: testOrgName });
    await row.getByRole('button', { name: /削除/i }).click();

    // 成功メッセージが表示される
    await expect(page.getByText(/組織を削除しました/i)).toBeVisible();

    // 一覧から削除される
    await expect(page.getByText(testOrgName)).not.toBeVisible();

    // クリーンアップ（念のため）
    await deleteTestOrganization(testOrgId);
  });

  test('ops → メンバーが存在する組織の削除は失敗する', async ({ page }) => {
    await uiLogin(page, OPS_USER.email, PASSWORD);
    await page.goto(`${DOMAINS.OPS}/orgs`);

    // Test Organization (owner1, admin1, member1がいる) の削除を試みる
    // スラッグ 'acme' で絞り込む
    const row = page.locator('tr', { hasText: 'acme' });
    await expect(row).toBeVisible();

    // メンバー数が0以上であることを確認
    const memberCountCell = row.locator('td').nth(4); // メンバー数列
    const memberCountText = await memberCountCell.textContent();
    const memberCount = parseInt(memberCountText || '0');
    expect(memberCount).toBeGreaterThan(0);

    // 削除ダイアログをacceptするように設定
    page.on('dialog', dialog => {
      // メンバー数チェックのアラートが表示される
      expect(dialog.message()).toMatch(/メンバーが.*人存在するため削除できません/);
      dialog.accept();
    });

    // 削除ボタンをクリック
    await row.getByRole('button', { name: /削除/i }).click();

    // 一覧から削除されていないことを確認（スラッグで判定）
    await expect(page.getByText('acme')).toBeVisible();
  });

  test('ops → スラッグの編集が成功する', async ({ page }) => {
    await uiLogin(page, OPS_USER.email, PASSWORD);

    // テスト用組織を作成
    const testOrgName = `スラッグ編集テスト-${Date.now()}`;
    const originalSlug = `slug-edit-test-${Date.now()}`;
    const testOrgId = await createTestOrganization(testOrgName, originalSlug);

    try {
      await page.goto(`${DOMAINS.OPS}/orgs`);

      // 作成した組織の編集ボタンをクリック
      const row = page.locator('tr', { hasText: testOrgName });
      await row.getByRole('button', { name: /編集/i }).click();

      // モーダルが表示される
      await expect(page.getByRole('heading', { name: /組織を編集/i })).toBeVisible();

      // スラッグを変更
      const newSlug = `edited-slug-${Date.now()}`;
      await page.locator('input#slug').fill(newSlug);

      // 更新ボタンをクリック
      await page.getByRole('button', { name: /更新/i }).click();

      // モーダルが閉じる
      await expect(page.getByRole('heading', { name: /組織を編集/i })).not.toBeVisible();

      // 成功メッセージが表示される
      await expect(page.getByText(/組織を更新しました/i)).toBeVisible();

      // 一覧に変更が反映される
      await expect(page.getByText(newSlug)).toBeVisible();
    } finally {
      await deleteTestOrganization(testOrgId);
    }
  });

  test('ops → キャンセルボタンでモーダルが閉じる', async ({ page }) => {
    await uiLogin(page, OPS_USER.email, PASSWORD);
    await page.goto(`${DOMAINS.OPS}/orgs`);

    // 編集ボタンをクリック
    await page.getByRole('button', { name: /編集/i }).first().click();

    // モーダルが表示される
    await expect(page.getByRole('heading', { name: /組織を編集/i })).toBeVisible();

    // キャンセルボタンをクリック
    await page.getByRole('button', { name: /キャンセル/i }).click();

    // モーダルが閉じる
    await expect(page.getByRole('heading', { name: /組織を編集/i })).not.toBeVisible();
  });

  test('ops → 組織名が空の場合はエラー', async ({ page }) => {
    await uiLogin(page, OPS_USER.email, PASSWORD);
    await page.goto(`${DOMAINS.OPS}/orgs`);

    // 編集ボタンをクリック
    await page.getByRole('button', { name: /編集/i }).first().click();

    // モーダルが表示される
    await expect(page.getByRole('heading', { name: /組織を編集/i })).toBeVisible();

    // 組織名を空にする
    await page.locator('input#name').fill('');

    // 更新ボタンをクリック
    await page.getByRole('button', { name: /更新/i }).click();

    // HTML5のrequired属性により送信がブロックされる
    // モーダルは閉じない
    await expect(page.getByRole('heading', { name: /組織を編集/i })).toBeVisible();
  });

  test('ops → ナビゲーションに組織一覧リンクが表示される', async ({ page }) => {
    await uiLogin(page, OPS_USER.email, PASSWORD);
    await page.goto(`${DOMAINS.OPS}`);

    // ナビゲーションに組織一覧リンクが表示される
    const orgsLink = page.locator('a[href="/orgs"]');
    await expect(orgsLink).toBeVisible();
    await expect(orgsLink).toHaveText(/組織一覧/i);
  });

  test('ops → 組織名リンクから組織詳細に遷移できる', async ({ page }) => {
    await uiLogin(page, OPS_USER.email, PASSWORD);
    await page.goto(`${DOMAINS.OPS}/orgs`);

    // 最初の組織名リンクをクリック
    const firstOrgLink = page.locator('table tbody tr').first().locator('a');
    const orgId = await firstOrgLink.getAttribute('href');

    await firstOrgLink.click();

    // 組織詳細ページに遷移する
    await expect(page).toHaveURL(new RegExp(`${DOMAINS.OPS}/orgs/.+`));
  });
});
