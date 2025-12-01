/**
 * Owner権限譲渡保護テスト
 *
 * admin/memberがowner権限譲渡を試行しても拒否されることを検証。
 */
import { test, expect } from '@playwright/test';
import { uiLogin } from '../../helpers/auth';
import { DOMAINS } from '../../helpers/domains';

const ADMIN2 = { email: 'admin2@example.com' };
const OWNER5 = { email: 'owner5@example.com' };
const PASSWORD = process.env.E2E_TEST_PASSWORD!;

test.describe('Owner transfer protection', () => {
  test('adminがowner権限譲渡ボタンにアクセスできない', async ({ page }) => {
    // admin権限でログイン
    await uiLogin(page, ADMIN2.email, PASSWORD);

    // 組織設定ページにアクセス
    await page.goto(`${DOMAINS.ADMIN}/org-settings?org=beta`, { waitUntil: 'domcontentloaded' });

    // owner権限譲渡のUIが表示されていないことを確認
    // または権限不足でページ自体にアクセスできない
    const bodyText = await page.locator('body').textContent();
    const hasTransferButton = bodyText?.includes('権限譲渡') || bodyText?.includes('transfer');
    const isUnauthorized = bodyText?.includes('unauthorized') ||
      bodyText?.includes('権限がありません') ||
      page.url().includes('unauthorized');

    // adminには権限譲渡ボタンが表示されない、またはページアクセス拒否
    expect(hasTransferButton === false || isUnauthorized).toBe(true);
  });

  test('owner以外がorg-settingsのowner専用操作にアクセスできない', async ({ page }) => {
    // owner5はorg1にadminとして所属（owner3-6はadminロール）
    await uiLogin(page, OWNER5.email, PASSWORD);

    // org-settingsページにアクセス
    await page.goto(`${DOMAINS.ADMIN}/org-settings?org=acme`, { waitUntil: 'domcontentloaded' });

    const bodyText = await page.locator('body').textContent();

    // owner5はadminロールなので、owner専用機能（組織凍結、削除など）は見えない
    // または権限不足でページにアクセスできない
    const hasOwnerOnlyFeatures =
      bodyText?.includes('組織を凍結') ||
      bodyText?.includes('組織を削除') ||
      bodyText?.includes('freeze') ||
      bodyText?.includes('delete organization');

    const isUnauthorized = bodyText?.includes('unauthorized') ||
      bodyText?.includes('権限がありません') ||
      page.url().includes('unauthorized');

    // owner以外にはowner専用機能が表示されない、またはページアクセス拒否
    expect(hasOwnerOnlyFeatures === false || isUnauthorized).toBe(true);
  });
});
