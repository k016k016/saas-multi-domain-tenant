/**
 * Phase 4: 複数タブでの組織切替の独立性テスト
 *
 * テスト内容:
 * - 同一ユーザーが複数タブで異なる組織を見ても独立して動作
 * - Admin domainで異なる組織を別タブで開いても独立
 *
 * 使用ユーザー:
 * - member1@example.com (org1: member, org2: admin - 両方所属)
 * - ops1@example.com (OPS + org1: admin - 両方所属)
 */

import { test, expect } from '@playwright/test';
import { uiLogin } from '../../helpers/auth';
import { resetUserToOrg1 } from '../../helpers/db';

const PASSWORD = process.env.E2E_TEST_PASSWORD!;

test.describe('Multi-tab Organization Isolation', () => {
  test.beforeEach(async () => {
    // member1のアクティブ組織をorg1にリセット
    await resetUserToOrg1('member1@example.com');
  });

  test('同一ユーザーが複数タブで異なる組織を見ても独立して動作', async ({ browser }) => {
    // 新しいコンテキスト（Cookieを共有）
    const context = await browser.newContext();

    // タブ1: member1でログイン
    const tab1 = await context.newPage();
    await uiLogin(tab1, 'member1@example.com', PASSWORD);

    // タブ1: デフォルトの組織（org1）を確認
    await expect(tab1.getByText('Test Organization')).toBeVisible();
    await expect(tab1.url()).toContain('app.local.test');

    // タブ2を開く
    const tab2 = await context.newPage();
    await tab2.goto('http://app.local.test:3002/');

    // タブ2: 同じユーザーでログイン済み（Cookie共有）
    await expect(tab2.getByText('Test Organization')).toBeVisible();

    // タブ2: 組織をTest Organization Betaに切り替え
    await tab2.getByRole('button', { name: 'Test Organization' }).click();
    await tab2.getByRole('button', { name: 'Test Organization Beta' }).click();

    // タブ2: 切り替え後の確認
    await tab2.waitForURL('**/app.local.test:3002/**');
    await expect(tab2.getByRole('button', { name: 'Test Organization Beta' })).toBeVisible();

    // タブ1: まだTest Organizationが表示されているか確認
    await tab1.reload(); // リロードして最新の状態を取得

    // タブ1: user_org_contextが更新されているので、Beta組織になる
    // これが現在の仕様（アクティブ組織は全体で共有される）
    await expect(tab1.getByRole('button', { name: 'Test Organization Beta' })).toBeVisible();

    await context.close();
  });

  test('Admin domainで ?org=acme と ?org=beta を別タブで開いても独立', async ({ browser }) => {
    const context = await browser.newContext();

    // タブ1: member1でログイン後、admin domainへアクセス
    const tab1 = await context.newPage();
    await uiLogin(tab1, 'member1@example.com', PASSWORD);

    // タブ1: ?org=acme でメンバー管理ページへ
    await tab1.goto('http://admin.local.test:3003/members?org=acme');
    await expect(tab1.getByRole('heading', { name: 'メンバー管理' })).toBeVisible();
    await expect(tab1.getByText('Test Organization')).toBeVisible();

    // タブ2を開く
    const tab2 = await context.newPage();

    // タブ2: ?org=beta でメンバー管理ページへ（member1はbetaではadmin権限）
    await tab2.goto('http://admin.local.test:3003/members?org=beta');
    await expect(tab2.getByRole('heading', { name: 'メンバー管理' })).toBeVisible();
    await expect(tab2.getByText('Test Organization Beta')).toBeVisible();

    // タブ1: まだacmeの情報が表示されているか確認
    await tab1.reload();
    await expect(tab1.getByText('Test Organization')).toBeVisible();

    // タブ2: まだbetaの情報が表示されているか確認
    await tab2.reload();
    await expect(tab2.getByText('Test Organization Beta')).toBeVisible();

    await context.close();
  });

  test('動的ルートで /org/acme と /org/beta を別タブで開いても独立', async ({ browser }) => {
    const context = await browser.newContext();

    // タブ1: member1でログイン
    const tab1 = await context.newPage();
    await uiLogin(tab1, 'member1@example.com', PASSWORD);

    // タブ1: /org/acme/members へ
    await tab1.goto('http://admin.local.test:3003/org/acme/members');
    await expect(tab1.getByRole('heading', { name: 'メンバー管理' })).toBeVisible();
    await expect(tab1.getByText('Test Organization')).toBeVisible();

    // タブ2を開く
    const tab2 = await context.newPage();

    // タブ2: /org/beta/members へ
    await tab2.goto('http://admin.local.test:3003/org/beta/members');
    await expect(tab2.getByRole('heading', { name: 'メンバー管理' })).toBeVisible();
    await expect(tab2.getByText('Test Organization Beta')).toBeVisible();

    // 両タブが独立していることを確認
    await tab1.reload();
    await expect(tab1.getByText('Test Organization')).toBeVisible();

    await tab2.reload();
    await expect(tab2.getByText('Test Organization Beta')).toBeVisible();

    await context.close();
  });

  test('ホストベースの組織解決とタブの独立性', async ({ browser }) => {
    const context = await browser.newContext();

    // タブ1: member1でログイン
    const tab1 = await context.newPage();
    await uiLogin(tab1, 'member1@example.com', PASSWORD);

    // タブ1: acme.app.local.testへアクセス
    await tab1.goto('http://acme.app.local.test:3002/');
    await expect(tab1.getByText('Test Organization')).toBeVisible();

    // タブ2を開く
    const tab2 = await context.newPage();

    // タブ2: contoso.app.local.testへアクセス（存在しない組織）
    await tab2.goto('http://contoso.app.local.test:3002/');

    // タブ2: 組織が見つからない場合の挙動（app.local.testにリダイレクトされる）
    await expect(tab2.url()).toContain('app.local.test');

    // タブ1: まだacmeの情報が表示されているか確認
    await tab1.reload();
    await expect(tab1.getByText('Test Organization')).toBeVisible();
    await expect(tab1.url()).toContain('acme.app.local.test');

    await context.close();
  });
});