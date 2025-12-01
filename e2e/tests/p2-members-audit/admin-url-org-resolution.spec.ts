/**
 * Phase 3: Admin ドメインの URL ベース組織指定 E2E tests
 *
 * テスト内容:
 * - 動的ルート /o/[orgSlug]/members でのアクセス
 * - URLパラメータ ?org=slug でのアクセス
 * - 従来の getCurrentOrg() 方式との互換性
 *
 * テスト前提:
 * - Test Organization (slug: acme)
 * - Test Organization Beta (slug: beta)
 * - owner1@example.com は Test Organization のowner
 * - owner2@example.com は Test Organization Beta のowner
 */

import { test, expect, Page } from '@playwright/test';
import { uiLogin } from '../../helpers/auth';

const PASSWORD = process.env.E2E_TEST_PASSWORD!;
const orgSummary = (page: Page, name: string) =>
  page.locator('p', { hasText: '組織:' }).locator('strong', { hasText: name }).first();
const orgHeading = (page: Page, name: string) =>
  page.getByRole('heading', { name }).first();

// owner1を共有するため、このファイルのテストは直列実行
test.describe.configure({ mode: 'serial' });

test.describe('Admin URL-based Organization Resolution', () => {
  test('動的ルート /org/acme/members で Test Organization のメンバー一覧が表示される', async ({ page }) => {
    // owner1でログイン
    await uiLogin(page, 'owner1@example.com', PASSWORD);

    // 動的ルートでアクセス
    await page.goto('http://admin.local.test:3003/org/acme/members');

    // ページタイトルとメンバー一覧が表示される
    await expect(page.getByRole('heading', { name: 'メンバー管理' })).toBeVisible();
    await expect(orgSummary(page, 'Test Organization')).toBeVisible();

    // メンバー一覧テーブルにOWNERロールが存在する
    await expect(page.locator('table')).toBeVisible();
    await expect(page.getByText('OWNER', { exact: true })).toBeVisible();
  });

  test('動的ルート /org/beta/members で Test Organization Beta のメンバー一覧が表示される', async ({ page }) => {
    // owner2でログイン
    await uiLogin(page, 'owner2@example.com', PASSWORD);

    // 動的ルートでアクセス
    await page.goto('http://admin.local.test:3003/org/beta/members');

    // ページタイトルとメンバー一覧が表示される
    await expect(page.getByRole('heading', { name: 'メンバー管理' })).toBeVisible();
    await expect(orgSummary(page, 'Test Organization Beta')).toBeVisible();

    // owner2@example.com がメンバー一覧に表示される
    await expect(page.getByText('owner2@example.com')).toBeVisible();
  });

  test('URLパラメータ ?org=acme で Test Organization のメンバー一覧が表示される', async ({ page }) => {
    // owner1でログイン
    await uiLogin(page, 'owner1@example.com', PASSWORD);

    // URLパラメータでアクセス
    await page.goto('http://admin.local.test:3003/members?org=acme');

    // ページタイトルとメンバー一覧が表示される
    await expect(page.getByRole('heading', { name: 'メンバー管理' })).toBeVisible();
    await expect(orgSummary(page, 'Test Organization')).toBeVisible();

    // メンバー一覧テーブルにOWNERロールが存在する
    await expect(page.locator('table')).toBeVisible();
    await expect(page.getByText('OWNER', { exact: true })).toBeVisible();
  });

  test('URLパラメータ ?org=beta で Test Organization Beta のメンバー一覧が表示される', async ({ page }) => {
    // owner2でログイン
    await uiLogin(page, 'owner2@example.com', PASSWORD);

    // URLパラメータでアクセス
    await page.goto('http://admin.local.test:3003/members?org=beta');

    // ページタイトルとメンバー一覧が表示される
    await expect(page.getByRole('heading', { name: 'メンバー管理' })).toBeVisible();
    await expect(orgSummary(page, 'Test Organization Beta')).toBeVisible();

    // owner2@example.com がメンバー一覧に表示される
    await expect(page.getByText('owner2@example.com')).toBeVisible();
  });

  test('動的ルート /org/acme/org-settings で Test Organization の組織設定が表示される', async ({ page }) => {
    // owner1でログイン
    await uiLogin(page, 'owner1@example.com', PASSWORD);

    // 動的ルートでアクセス
    await page.goto('http://admin.local.test:3003/org/acme/org-settings');

    // 組織設定ページが表示される
    await expect(page.getByRole('heading', { name: '組織設定' })).toBeVisible();
    await expect(orgHeading(page, 'Test Organization')).toBeVisible();
  });

  test('動的ルート /org/acme/audit-logs で Test Organization の監査ログが表示される', async ({ page }) => {
    // owner1でログイン
    await uiLogin(page, 'owner1@example.com', PASSWORD);

    // 動的ルートでアクセス
    await page.goto('http://admin.local.test:3003/org/acme/audit-logs');

    // 監査ログページが表示される
    await expect(page.getByRole('heading', { name: '監査ログ' })).toBeVisible();
    await expect(orgHeading(page, 'Test Organization')).toBeVisible();
  });

  test('存在しない組織slugでアクセスすると404が表示される', async ({ page }) => {
    // owner1でログイン
    await uiLogin(page, 'owner1@example.com', PASSWORD);

    // 存在しない組織のslugでアクセス
    await page.goto('http://admin.local.test:3003/org/nonexistent/members');

    // 404ページが表示される
    await expect(page.getByText(/not found|404/i)).toBeVisible();
  });

  test('所属していない組織のslugでアクセスすると404が表示される', async ({ page }) => {
    // owner1でログイン（Test Organization のみ所属）
    await uiLogin(page, 'owner1@example.com', PASSWORD);

    // owner1が所属していないTest Organization Beta (beta)にアクセス
    await page.goto('http://admin.local.test:3003/org/beta/members');

    // 404ページが表示される
    await expect(page.getByText(/not found|404/i)).toBeVisible();
  });
});
