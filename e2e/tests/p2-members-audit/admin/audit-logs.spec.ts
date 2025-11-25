import { test, expect } from '@playwright/test';
import { DOMAINS } from '../../../helpers/domains';
import { uiLogin } from '../../../helpers/auth';
import { resetUserToOrg1 } from '../../../helpers/db';

const ADMIN = { email: 'admin1@example.com' };
const OWNER = { email: 'owner1@example.com' };
const MEMBER = { email: 'member-switcher@example.com' };
const PASSWORD = process.env.E2E_TEST_PASSWORD!;

test.describe('監査ログ閲覧UI', () => {
  // 各テスト前にmember1をorg1（member権限）にリセット
  test.beforeEach(async () => {
    await resetUserToOrg1(MEMBER.email);
  });
  test('admin → 監査ログページにアクセス可能', async ({ page }) => {
    await uiLogin(page, ADMIN.email, PASSWORD);
    await page.goto(`${DOMAINS.ADMIN}/audit-logs`);

    await expect(page.getByRole('heading', { name: /監査ログ/i })).toBeVisible();
  });

  test('owner → 監査ログページにアクセス可能', async ({ page }) => {
    await uiLogin(page, OWNER.email, PASSWORD);
    await page.goto(`${DOMAINS.ADMIN}/audit-logs`);

    await expect(page.getByRole('heading', { name: /監査ログ/i })).toBeVisible();
  });

  test('member → 監査ログページにアクセス不可（/unauthorizedへリダイレクト）', async ({ page }) => {
    await uiLogin(page, MEMBER.email, PASSWORD);
    await page.goto(`${DOMAINS.ADMIN}/audit-logs`);

    // UX改善: 権限エラー時は専用の/unauthorizedページにリダイレクト
    await expect(page).toHaveURL(new RegExp(`${DOMAINS.ADMIN}/unauthorized`));
  });

  test('admin → 監査ログテーブルが表示される', async ({ page }) => {
    await uiLogin(page, ADMIN.email, PASSWORD);
    await page.goto(`${DOMAINS.ADMIN}/audit-logs`);

    await expect(page.getByRole('table')).toBeVisible();
  });

  test('admin → フィルタUIが存在する', async ({ page }) => {
    await uiLogin(page, ADMIN.email, PASSWORD);
    await page.goto(`${DOMAINS.ADMIN}/audit-logs`);

    await expect(page.locator('select#action')).toBeVisible();
    await expect(page.locator('select#days')).toBeVisible();
    await expect(page.getByRole('button', { name: /フィルタ適用/i })).toBeVisible();
  });

  test('admin → アクション種別でフィルタリングできる', async ({ page }) => {
    await uiLogin(page, ADMIN.email, PASSWORD);
    await page.goto(`${DOMAINS.ADMIN}/audit-logs`);

    await page.locator('select#action').selectOption('org.switched');
    await page.getByRole('button', { name: /フィルタ適用/i }).click();

    await expect(page).toHaveURL(/action=org\.switched/);
  });

  test('admin → 期間でフィルタリングできる', async ({ page }) => {
    await uiLogin(page, ADMIN.email, PASSWORD);
    await page.goto(`${DOMAINS.ADMIN}/audit-logs`);

    await page.locator('select#days').selectOption('30');
    await page.getByRole('button', { name: /フィルタ適用/i }).click();

    await expect(page).toHaveURL(/days=30/);
  });

  test('admin → 実行者名でフィルタリングできる', async ({ page }) => {
    await uiLogin(page, ADMIN.email, PASSWORD);
    await page.goto(`${DOMAINS.ADMIN}/audit-logs`);

    // 実行者名フィルタに入力
    await page.locator('input#name').fill('鈴木');
    await page.getByRole('button', { name: /フィルタ適用/i }).click();

    await expect(page).toHaveURL(/name=%E9%88%B4%E6%9C%A8/);
  });

  test('admin → メールアドレスでフィルタリングできる', async ({ page }) => {
    await uiLogin(page, ADMIN.email, PASSWORD);
    await page.goto(`${DOMAINS.ADMIN}/audit-logs`);

    // メールフィルタに入力
    await page.locator('input#email').fill('admin1');
    await page.getByRole('button', { name: /フィルタ適用/i }).click();

    await expect(page).toHaveURL(/email=admin1/);
  });

  test('admin → 複合フィルタが適用される', async ({ page }) => {
    await uiLogin(page, ADMIN.email, PASSWORD);
    await page.goto(`${DOMAINS.ADMIN}/audit-logs`);

    // 複数条件を設定
    await page.locator('select#action').selectOption('member.invited');
    await page.locator('select#days').selectOption('30');
    await page.locator('input#email').fill('admin');
    await page.getByRole('button', { name: /フィルタ適用/i }).click();

    // URLに全条件が含まれる
    await expect(page).toHaveURL(/action=member\.invited/);
    await expect(page).toHaveURL(/days=30/);
    await expect(page).toHaveURL(/email=admin/);
  });

  test('admin → CSVダウンロードリンクが存在する', async ({ page }) => {
    await uiLogin(page, ADMIN.email, PASSWORD);
    await page.goto(`${DOMAINS.ADMIN}/audit-logs?days=90`);

    // CSVダウンロードリンクが表示される
    const csvLink = page.getByRole('link', { name: /CSVダウンロード/i });
    await expect(csvLink).toBeVisible();

    // href属性がdata:text/csvで始まることを確認
    const href = await csvLink.getAttribute('href');
    expect(href).toMatch(/^data:text\/csv/);
  });
});
