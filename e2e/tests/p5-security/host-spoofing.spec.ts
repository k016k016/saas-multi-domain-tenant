import { test, expect } from '@playwright/test';
import { uiLogin } from '../../helpers/auth';

// member2はorg2（beta）のみ所属。org1（acme）への不正アクセスを検証
const MEMBER = { email: 'member2@example.com' };
const PASSWORD = process.env.E2E_TEST_PASSWORD!;

test.describe('Host-based org spoofing', () => {
  test('未所属ホストに直接アクセスしても404', async ({ page }) => {
    // member2（org2のみ所属）でログイン
    await uiLogin(page, MEMBER.email, PASSWORD);

    // org1（acme）のホストにアクセス→未所属なので404
    const response = await page.goto('http://acme.app.local.test:3002/', { waitUntil: 'domcontentloaded' });
    // 404ステータスコードが返ることを検証（アプリ側でnotFound()を呼び出している）
    // bodyの内容検証はCI環境でdomcontentloaded時点で空になるため省略
    expect(response?.status()).toBe(404);
  });
});
