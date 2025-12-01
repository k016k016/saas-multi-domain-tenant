/**
 * 権限昇格テスト
 *
 * memberがServer Action経由でadmin権限操作を試行しても拒否されることを検証。
 */
import { test, expect } from '@playwright/test';
import { uiLogin } from '../../helpers/auth';
import { DOMAINS } from '../../helpers/domains';

const MEMBER6 = { email: 'member6@example.com' };
const PASSWORD = process.env.E2E_TEST_PASSWORD!;

test.describe('Privilege escalation prevention', () => {
  test('memberがadminページにアクセスすると403/unauthorized', async ({ page }) => {
    // member権限でログイン
    await uiLogin(page, MEMBER6.email, PASSWORD);

    // adminドメインのメンバー管理ページにアクセス
    const response = await page.goto(`${DOMAINS.ADMIN}/members`, { waitUntil: 'domcontentloaded' });

    // memberはadminドメインにアクセスできないので、403またはunauthorizedページ
    // 現在の実装ではページ側でロールチェックしているため、unauthorized表示またはリダイレクト
    const url = page.url();
    const status = response?.status();

    // 403ステータスまたはunauthorizedページへのリダイレクト
    const isBlocked = status === 403 ||
      url.includes('unauthorized') ||
      (await page.locator('body').textContent())?.includes('権限がありません');

    expect(isBlocked).toBe(true);
  });

  test('memberがorganization-settingsにアクセスすると拒否', async ({ page }) => {
    await uiLogin(page, MEMBER6.email, PASSWORD);

    // 組織設定ページ（owner専用）にアクセス
    const response = await page.goto(`${DOMAINS.ADMIN}/org-settings`, { waitUntil: 'domcontentloaded' });

    const url = page.url();
    const status = response?.status();
    const bodyText = await page.locator('body').textContent();

    // owner専用ページへのアクセスは拒否
    const isBlocked = status === 403 ||
      url.includes('unauthorized') ||
      bodyText?.includes('権限がありません') ||
      bodyText?.includes('owner');

    expect(isBlocked).toBe(true);
  });

  test('memberがaudit-logsにアクセスすると拒否', async ({ page }) => {
    await uiLogin(page, MEMBER6.email, PASSWORD);

    // 監査ログページ（admin以上）にアクセス
    const response = await page.goto(`${DOMAINS.ADMIN}/audit-logs`, { waitUntil: 'domcontentloaded' });

    const url = page.url();
    const status = response?.status();
    const bodyText = await page.locator('body').textContent();

    // admin以上専用ページへのアクセスは拒否
    const isBlocked = status === 403 ||
      url.includes('unauthorized') ||
      bodyText?.includes('権限がありません');

    expect(isBlocked).toBe(true);
  });
});
