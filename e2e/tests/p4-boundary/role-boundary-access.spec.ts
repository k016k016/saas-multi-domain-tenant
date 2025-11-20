/**
 * Phase 4: ロール別のアクセス境界テスト
 *
 * テスト内容:
 * - memberの各ドメインへのアクセス制限
 * - adminの各ドメインへのアクセス制限
 * - ownerの全ページへのアクセス
 * - 未認証ユーザーのアクセス制限
 *
 * 使用ユーザー:
 * - member1@example.com (org1: member, org2: admin)
 * - admin1@example.com (org1: admin, org2: member)
 * - owner1@example.com (org1: owner)
 */

import { test, expect } from '@playwright/test';
import { uiLogin } from '../../helpers/auth';
import { resetUserToOrg1 } from '../../helpers/db';

const PASSWORD = process.env.E2E_TEST_PASSWORD!;

test.describe('Role-based Access Boundaries', () => {
  test.beforeEach(async () => {
    // 各ユーザーのアクティブ組織をorg1にリセット
    await resetUserToOrg1('member1@example.com');
    await resetUserToOrg1('admin1@example.com');
    await resetUserToOrg1('owner1@example.com');
  });

  test.describe('Member権限のアクセス境界', () => {
    test('memberは admin.local.test/members に403/unauthorized', async ({ page }) => {
      // member1でログイン（org1でのロールはmember）
      await uiLogin(page, 'member1@example.com', PASSWORD);

      // admin domainのメンバー管理ページへアクセス
      await page.goto('http://admin.local.test:3003/members');

      // 403またはunauthorizedページへリダイレクト
      await expect(page).toHaveURL(/unauthorized/);
      await expect(page.getByRole('heading', { name: '403' })).toBeVisible();
    });

    test('memberは admin.local.test/org-settings に403/unauthorized', async ({ page }) => {
      await uiLogin(page, 'member1@example.com', PASSWORD);

      // admin domainの組織設定ページへアクセス
      await page.goto('http://admin.local.test:3003/org-settings');

      // 403またはunauthorizedページへリダイレクト
      await expect(page).toHaveURL(/unauthorized/);
      await expect(page.getByRole('heading', { name: '403' })).toBeVisible();
    });

    test('memberは admin.local.test/audit-logs に403/unauthorized', async ({ page }) => {
      await uiLogin(page, 'member1@example.com', PASSWORD);

      // admin domainの監査ログページへアクセス
      await page.goto('http://admin.local.test:3003/audit-logs');

      // 403またはunauthorizedページへリダイレクト
      await expect(page).toHaveURL(/unauthorized/);
      await expect(page.getByRole('heading', { name: '403' })).toBeVisible();
    });

    test('memberは app.local.test にアクセス可能', async ({ page }) => {
      await uiLogin(page, 'member1@example.com', PASSWORD);

      // app domainへアクセス（既にログイン後はapp.local.testにいるはず）
      await expect(page.url()).toContain('app.local.test');
      await expect(page.getByText('Test Organization')).toBeVisible();
    });

    test('memberは acme.app.local.test にアクセス可能', async ({ page }) => {
      await uiLogin(page, 'member1@example.com', PASSWORD);

      // ホストベースの組織URLへアクセス
      await page.goto('http://acme.app.local.test:3002/');
      await expect(page.getByText('Test Organization')).toBeVisible();
      await expect(page.url()).toContain('acme.app.local.test');
    });

    test('memberは ops.local.test に404（非OPSユーザー）', async ({ page }) => {
      await uiLogin(page, 'member1@example.com', PASSWORD);

      // OPS domainへアクセス
      await page.goto('http://ops.local.test:3004/');

      // 404エラー（OPSユーザーではない）
      await expect(page.getByText(/404|not found/i)).toBeVisible();
    });
  });

  test.describe('Admin権限のアクセス境界', () => {
    test('adminは admin.local.test/members にアクセス可能', async ({ page }) => {
      // admin1でログイン（org1でのロールはadmin）
      await uiLogin(page, 'admin1@example.com', PASSWORD);

      // admin domainのメンバー管理ページへアクセス
      await page.goto('http://admin.local.test:3003/members');

      // 正常にアクセスできる
      await expect(page.getByRole('heading', { name: 'メンバー管理' })).toBeVisible();
      await expect(page.getByText('Test Organization')).toBeVisible();
    });

    test('adminは admin.local.test/org-settings に403（ownerのみ）', async ({ page }) => {
      await uiLogin(page, 'admin1@example.com', PASSWORD);

      // admin domainの組織設定ページへアクセス
      await page.goto('http://admin.local.test:3003/org-settings');

      // ownerのみアクセス可能なので403
      await expect(page).toHaveURL(/unauthorized/);
      await expect(page.getByRole('heading', { name: '403' })).toBeVisible();
    });

    test('adminは admin.local.test/audit-logs にアクセス可能', async ({ page }) => {
      await uiLogin(page, 'admin1@example.com', PASSWORD);

      // admin domainの監査ログページへアクセス
      await page.goto('http://admin.local.test:3003/audit-logs');

      // 正常にアクセスできる
      await expect(page.getByRole('heading', { name: '監査ログ' })).toBeVisible();
      await expect(page.getByText('Test Organization')).toBeVisible();
    });

    test('adminは app.local.test にアクセス可能', async ({ page }) => {
      await uiLogin(page, 'admin1@example.com', PASSWORD);

      // app domainへアクセス
      await expect(page.url()).toContain('app.local.test');
      await expect(page.getByText('Test Organization')).toBeVisible();
    });

    test('adminは ops.local.test に404（非OPSユーザー）', async ({ page }) => {
      await uiLogin(page, 'admin1@example.com', PASSWORD);

      // OPS domainへアクセス
      await page.goto('http://ops.local.test:3004/');

      // 404エラー（OPSユーザーではない）
      await expect(page.getByText(/404|not found/i)).toBeVisible();
    });
  });

  test.describe('Owner権限のアクセス境界', () => {
    test('ownerは admin.local.test/members にアクセス可能', async ({ page }) => {
      // owner1でログイン（org1でのロールはowner）
      await uiLogin(page, 'owner1@example.com', PASSWORD);

      // admin domainのメンバー管理ページへアクセス
      await page.goto('http://admin.local.test:3003/members');

      // 正常にアクセスできる
      await expect(page.getByRole('heading', { name: 'メンバー管理' })).toBeVisible();
      await expect(page.getByText('Test Organization')).toBeVisible();
    });

    test('ownerは admin.local.test/org-settings にアクセス可能', async ({ page }) => {
      await uiLogin(page, 'owner1@example.com', PASSWORD);

      // admin domainの組織設定ページへアクセス
      await page.goto('http://admin.local.test:3003/org-settings');

      // 正常にアクセスできる（ownerのみ可能）
      await expect(page.getByRole('heading', { name: '組織設定' })).toBeVisible();
      await expect(page.getByText('Test Organization')).toBeVisible();
    });

    test('ownerは admin.local.test/audit-logs にアクセス可能', async ({ page }) => {
      await uiLogin(page, 'owner1@example.com', PASSWORD);

      // admin domainの監査ログページへアクセス
      await page.goto('http://admin.local.test:3003/audit-logs');

      // 正常にアクセスできる
      await expect(page.getByRole('heading', { name: '監査ログ' })).toBeVisible();
      await expect(page.getByText('Test Organization')).toBeVisible();
    });

    test('ownerは app.local.test にアクセス可能', async ({ page }) => {
      await uiLogin(page, 'owner1@example.com', PASSWORD);

      // app domainへアクセス
      await expect(page.url()).toContain('app.local.test');
      await expect(page.getByText('Test Organization')).toBeVisible();
    });

    test('ownerは ops.local.test に404（非OPSユーザー）', async ({ page }) => {
      await uiLogin(page, 'owner1@example.com', PASSWORD);

      // OPS domainへアクセス
      await page.goto('http://ops.local.test:3004/');

      // 404エラー（OPSユーザーではない）
      await expect(page.getByText(/404|not found/i)).toBeVisible();
    });
  });

  test.describe('OPSユーザーのアクセス境界', () => {
    test('ops1は ops.local.test にアクセス可能', async ({ page }) => {
      // ops1でログイン
      await uiLogin(page, 'ops1@example.com', PASSWORD);

      // OPS domainへアクセス
      await page.goto('http://ops.local.test:3004/');

      // 正常にアクセスできる
      await expect(page.getByRole('heading', { name: 'OPS Dashboard' })).toBeVisible();
    });

    test('ops1は org1のadminとして admin.local.test/members にアクセス可能', async ({ page }) => {
      // ops1でログイン（org1でのロールはadmin）
      await uiLogin(page, 'ops1@example.com', PASSWORD);

      // admin domainのメンバー管理ページへアクセス
      await page.goto('http://admin.local.test:3003/members');

      // 正常にアクセスできる
      await expect(page.getByRole('heading', { name: 'メンバー管理' })).toBeVisible();
      await expect(page.getByText('Test Organization')).toBeVisible();
    });

    test('ops1は app.local.test にアクセス可能', async ({ page }) => {
      await uiLogin(page, 'ops1@example.com', PASSWORD);

      // app domainへアクセス
      await expect(page.url()).toContain('app.local.test');
      await expect(page.getByText('Test Organization')).toBeVisible();
    });
  });

  test.describe('未認証ユーザーのアクセス境界', () => {
    test('未認証ユーザーは app.local.test から www.local.test/login へリダイレクト', async ({ page }) => {
      // 未認証状態でapp domainへアクセス
      await page.goto('http://app.local.test:3002/');

      // www.local.testのログインページへリダイレクト
      await expect(page).toHaveURL(/www\.local\.test.*login/);
      await expect(page.getByRole('heading', { name: 'サインイン' })).toBeVisible();
    });

    test('未認証ユーザーは admin.local.test から www.local.test/login へリダイレクト', async ({ page }) => {
      // 未認証状態でadmin domainへアクセス
      await page.goto('http://admin.local.test:3003/');

      // www.local.testのログインページへリダイレクト
      await expect(page).toHaveURL(/www\.local\.test.*login/);
      await expect(page.getByRole('heading', { name: 'サインイン' })).toBeVisible();
    });

    test('未認証ユーザーは ops.local.test で404', async ({ page }) => {
      // 未認証状態でOPS domainへアクセス
      await page.goto('http://ops.local.test:3004/');

      // 404エラー（OPSは未認証でも404を返す）
      await expect(page.getByText(/404|not found/i)).toBeVisible();
    });

    test('未認証ユーザーは www.local.test にアクセス可能', async ({ page }) => {
      // 未認証状態でwww domainへアクセス
      await page.goto('http://www.local.test:3001/');

      // ランディングページまたはログインページが表示される
      const hasLanding = await page.getByRole('heading', { name: /multi-tenant saas/i }).isVisible().catch(() => false);
      const hasLogin = await page.getByRole('heading', { name: 'サインイン' }).isVisible().catch(() => false);

      expect(hasLanding || hasLogin).toBeTruthy();
    });
  });
});