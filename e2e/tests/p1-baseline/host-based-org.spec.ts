/**
 * Phase 2: Host-based organization resolution E2E tests
 *
 * テスト前提:
 * - Test Organization (slug: acme)
 * - Test Organization Beta (slug: beta)
 * - owner1@example.com は両組織のメンバー
 */

import { test, expect } from '@playwright/test';
import { uiLogin } from '../../helpers/auth';

const PASSWORD = process.env.E2E_TEST_PASSWORD!;

test.describe('Host-based Organization Resolution', () => {
  test('acme.app.local.test → Test Organization (acme)', async ({ page }) => {
    // owner1でログイン
    await uiLogin(page, 'owner1@example.com', PASSWORD);

    // acmeサブドメインでアクセス
    await page.goto('http://acme.app.local.test:3002/dashboard');

    // ダッシュボードが表示される
    await expect(page.getByRole('heading', { name: 'ダッシュボード' })).toBeVisible();

    // 組織名がTest Organization（acmeのslugを持つ組織）であることを確認
    await expect(page.locator('dd').filter({ hasText: 'Test Organization' }).first()).toBeVisible();
  });

  test('beta.app.local.test → Test Organization Beta', async ({ page }) => {
    // owner2でログイン（Test Organization Betaのowner）
    await uiLogin(page, 'owner2@example.com', PASSWORD);

    // betaサブドメインでアクセス
    await page.goto('http://beta.app.local.test:3002/dashboard');

    // ダッシュボードが表示される
    await expect(page.getByRole('heading', { name: 'ダッシュボード' })).toBeVisible();

    // 組織名がTest Organization Beta（betaのslugを持つ組織）であることを確認
    await expect(page.locator('dd').filter({ hasText: 'Test Organization Beta' }).first()).toBeVisible();
  });

  test('同一ユーザーで別タブで異なる組織が表示される', async ({ browser }) => {
    // owner1はTest Organizationのメンバー（acme）
    // owner2はTest Organization Betaのメンバー（beta）
    const context = await browser.newContext();
    const page1 = await context.newPage();
    const page2 = await context.newPage();

    // タブ1: owner1でログイン → acme組織にアクセス
    await uiLogin(page1, 'owner1@example.com', PASSWORD);
    await page1.goto('http://acme.app.local.test:3002/dashboard');
    await expect(page1.getByRole('heading', { name: 'ダッシュボード' })).toBeVisible();
    await expect(page1.locator('dd').filter({ hasText: 'Test Organization' }).first()).toBeVisible();

    // タブ2: owner2でログイン → beta組織にアクセス
    await uiLogin(page2, 'owner2@example.com', PASSWORD);
    await page2.goto('http://beta.app.local.test:3002/dashboard');
    await expect(page2.getByRole('heading', { name: 'ダッシュボード' })).toBeVisible();
    await expect(page2.locator('dd').filter({ hasText: 'Test Organization Beta' }).first()).toBeVisible();

    await context.close();
  });
});
