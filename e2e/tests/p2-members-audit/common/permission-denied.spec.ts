import { test, expect } from '@playwright/test';
import { DOMAINS } from '../../../helpers/domains';
import { uiLogin } from '../../../helpers/auth';

// owner権限テスト用: owner1を使用（DB制約により各組織ownerは1人のみ）
const MEMBER = { email: 'member3@example.com' };
const ADMIN = { email: 'admin6@example.com' };
const OWNER = { email: 'owner1@example.com' };
const PASSWORD = process.env.E2E_TEST_PASSWORD!;

// owner1を共有するため、このファイルのテストは直列実行
test.describe.configure({ mode: 'serial' });

test.describe('権限拒否シナリオ', () => {
  test.describe('member の権限制限', () => {
    test.beforeEach(async ({ page }) => {
      await uiLogin(page, MEMBER.email, PASSWORD);
    });

    test('member が /admin/members にアクセス → アクセス拒否', async ({ page }) => {
      await page.goto(`${DOMAINS.ADMIN}/members`);

      // /unauthorizedにリダイレクトされるか、403相当のページが表示される
      await expect(page).toHaveURL(new RegExp(`${DOMAINS.ADMIN}/unauthorized`));
    });

    test('member が /admin/org-settings にアクセス → アクセス拒否', async ({ page }) => {
      await page.goto(`${DOMAINS.ADMIN}/org-settings`);

      await expect(page).toHaveURL(new RegExp(`${DOMAINS.ADMIN}/unauthorized`));
    });

    test('member が /admin/audit-logs にアクセス → アクセス拒否', async ({ page }) => {
      await page.goto(`${DOMAINS.ADMIN}/audit-logs`);

      await expect(page).toHaveURL(new RegExp(`${DOMAINS.ADMIN}/unauthorized`));
    });
  });

  test.describe('admin の権限制限', () => {
    test.beforeEach(async ({ page }) => {
      await uiLogin(page, ADMIN.email, PASSWORD);
    });

    test('admin が /admin/org-settings にアクセス → アクセス拒否（owner専用）', async ({ page }) => {
      await page.goto(`${DOMAINS.ADMIN}/org-settings`);

      // owner専用ページなのでアクセス拒否
      await expect(page).toHaveURL(new RegExp(`${DOMAINS.ADMIN}/unauthorized`));
    });
  });

  test.describe('owner 専用操作', () => {
    test('owner が /admin/org-settings にアクセス → 許可', async ({ page }) => {
      await uiLogin(page, OWNER.email, PASSWORD);

      const res = await page.goto(`${DOMAINS.ADMIN}/org-settings`);
      expect(res?.ok()).toBeTruthy();

      // 組織設定ページが表示される
      await expect(page.getByRole('heading', { name: /組織設定|org.*settings/i })).toBeVisible();
    });
  });

  test.describe('他組織リソースへのアクセス', () => {
    test('member が admin ドメインにアクセス → アクセス拒否', async ({ page }) => {
      // member1はorg1所属だがmemberロール
      await uiLogin(page, MEMBER.email, PASSWORD);

      // adminドメインへのアクセス（memberは拒否される）
      await page.goto(`${DOMAINS.ADMIN}/members`);

      // memberはadminドメインにアクセスできない
      await expect(page).toHaveURL(new RegExp(`${DOMAINS.ADMIN}/unauthorized`));
    });
  });
});
