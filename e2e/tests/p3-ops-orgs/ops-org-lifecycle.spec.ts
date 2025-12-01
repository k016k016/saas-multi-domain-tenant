import { test, expect } from '@playwright/test';
import { DOMAINS } from '../../helpers/domains';
import { uiLogin } from '../../helpers/auth';
import { createTestOrganization, deleteTestOrganization } from '../../helpers/db';

const OPS_USER = { email: 'ops1@example.com' };
const PASSWORD = process.env.E2E_TEST_PASSWORD!;

test.describe('組織ライフサイクル（OPS）', () => {
  test.describe('組織更新', () => {
    test('組織名とスラッグの同時変更が成功する', async ({ page }) => {
      await uiLogin(page, OPS_USER.email, PASSWORD);

      // テスト用組織を作成
      const originalName = `Lifecycle Test Org ${Date.now()}`;
      const originalSlug = `lifecycle-test-${Date.now()}`;
      const testOrgId = await createTestOrganization(originalName, originalSlug);

      try {
        await page.goto(`${DOMAINS.OPS}/orgs`);
        await expect(page.getByText(originalName)).toBeVisible();

        // 編集モーダルを開く
        const row = page.locator('tr', { hasText: originalName });
        await row.getByRole('button', { name: /編集/i }).click();
        await expect(page.getByRole('heading', { name: /組織を編集/i })).toBeVisible();

        // 名前とスラッグを同時に変更
        const newName = `Updated Org ${Date.now()}`;
        const newSlug = `updated-slug-${Date.now()}`;
        await page.locator('input#name').fill(newName);
        await page.locator('input#slug').fill(newSlug);

        // 更新実行
        await page.getByRole('button', { name: /更新/i }).click();

        // 成功確認
        await expect(page.getByText(/組織を更新しました/i)).toBeVisible();
        await expect(page.getByText(newName)).toBeVisible();
        await expect(page.getByText(newSlug)).toBeVisible();
      } finally {
        await deleteTestOrganization(testOrgId);
      }
    });

    test('プラン変更が正しく反映される', async ({ page }) => {
      await uiLogin(page, OPS_USER.email, PASSWORD);

      // テスト用組織を作成
      const testOrgName = `Plan Change Test ${Date.now()}`;
      const testOrgSlug = `plan-change-${Date.now()}`;
      const testOrgId = await createTestOrganization(testOrgName, testOrgSlug);

      try {
        await page.goto(`${DOMAINS.OPS}/orgs`);
        await expect(page.getByText(testOrgName)).toBeVisible();

        // 編集モーダルを開く
        const row = page.locator('tr', { hasText: testOrgName });
        await row.getByRole('button', { name: /編集/i }).click();
        await expect(page.getByRole('heading', { name: /組織を編集/i })).toBeVisible();

        // プランを変更
        await page.locator('select#plan').selectOption('enterprise');
        await page.getByRole('button', { name: /更新/i }).click();

        // モーダルが閉じることを確認
        await expect(page.getByRole('heading', { name: /組織を編集/i })).not.toBeVisible();

        // 成功メッセージ確認
        await expect(page.getByText(/組織を更新しました/i)).toBeVisible();

        // 一覧で「enterprise」が表示されていることを確認（既存テストと同じパターン）
        await expect(row.getByText('enterprise')).toBeVisible();
      } finally {
        await deleteTestOrganization(testOrgId);
      }
    });
  });

  test.describe('組織有効/無効の切り替え', () => {
    test('無効化 → 有効化のライフサイクルが成功する', async ({ page }) => {
      await uiLogin(page, OPS_USER.email, PASSWORD);

      // テスト用組織を作成
      const testOrgName = `Status Toggle Test ${Date.now()}`;
      const testOrgSlug = `status-toggle-${Date.now()}`;
      const testOrgId = await createTestOrganization(testOrgName, testOrgSlug);

      try {
        await page.goto(`${DOMAINS.OPS}/orgs`);
        await expect(page.getByText(testOrgName)).toBeVisible();

        const row = page.locator('tr', { hasText: testOrgName });

        // Step 1: 無効化
        await row.getByRole('button', { name: /編集/i }).click();
        const checkbox = page.locator('input[type="checkbox"]');
        await checkbox.uncheck();
        await page.getByRole('button', { name: /更新/i }).click();
        await expect(page.getByText(/組織を更新しました/i)).toBeVisible();

        // 無効状態の確認
        await expect(row.getByText(/無効/i)).toBeVisible();

        // Step 2: 有効化
        await row.getByRole('button', { name: /編集/i }).click();
        await checkbox.check();
        await page.getByRole('button', { name: /更新/i }).click();
        await expect(page.getByText(/組織を更新しました/i)).toBeVisible();

        // 有効状態の確認
        await expect(row.getByText(/有効/i)).toBeVisible();
      } finally {
        await deleteTestOrganization(testOrgId);
      }
    });
  });

  test.describe('組織削除', () => {
    test('メンバー0人の組織削除が成功する', async ({ page }) => {
      await uiLogin(page, OPS_USER.email, PASSWORD);

      // テスト用組織を作成（メンバー0人）
      const testOrgName = `Delete Success Test ${Date.now()}`;
      const testOrgSlug = `delete-success-${Date.now()}`;
      const testOrgId = await createTestOrganization(testOrgName, testOrgSlug);

      await page.goto(`${DOMAINS.OPS}/orgs`);
      await expect(page.getByText(testOrgName)).toBeVisible();

      // 削除ダイアログを自動承認
      page.on('dialog', dialog => dialog.accept());

      // 削除実行
      const row = page.locator('tr', { hasText: testOrgName });
      await row.getByRole('button', { name: /削除/i }).click();

      // 成功確認
      await expect(page.getByText(/組織を削除しました/i)).toBeVisible();
      await expect(page.getByText(testOrgName)).not.toBeVisible();

      // 念のためクリーンアップ試行
      await deleteTestOrganization(testOrgId);
    });

    test('削除キャンセルで組織が残る', async ({ page }) => {
      await uiLogin(page, OPS_USER.email, PASSWORD);

      // テスト用組織を作成
      const testOrgName = `Delete Cancel Test ${Date.now()}`;
      const testOrgSlug = `delete-cancel-${Date.now()}`;
      const testOrgId = await createTestOrganization(testOrgName, testOrgSlug);

      try {
        await page.goto(`${DOMAINS.OPS}/orgs`);
        await expect(page.getByText(testOrgName)).toBeVisible();

        // 削除ダイアログをキャンセル
        page.on('dialog', dialog => dialog.dismiss());

        // 削除ボタンをクリック
        const row = page.locator('tr', { hasText: testOrgName });
        await row.getByRole('button', { name: /削除/i }).click();

        // 組織が残っていることを確認
        await expect(page.getByText(testOrgName)).toBeVisible();
      } finally {
        await deleteTestOrganization(testOrgId);
      }
    });
  });

  test.describe('バリデーションエラー', () => {
    test('スラッグ重複でエラー表示', async ({ page }) => {
      await uiLogin(page, OPS_USER.email, PASSWORD);
      await page.goto(`${DOMAINS.OPS}/orgs`);

      // 既存組織（acme）の編集モーダルを開く
      const row = page.locator('tr', { hasText: 'acme' }).first();
      await row.getByRole('button', { name: /編集/i }).click();

      // 別の既存スラッグ（beta）に変更しようとする
      await page.locator('input#slug').fill('beta');
      await page.getByRole('button', { name: /更新/i }).click();

      // スラッグ重複エラーが表示される
      await expect(page.getByText(/既に使用されています|重複|duplicate/i)).toBeVisible();
    });
  });
});
