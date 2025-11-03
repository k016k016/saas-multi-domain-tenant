import { test, expect } from '@playwright/test';
import { DOMAINS } from '../../../helpers/domains';

// www/login >> cookies-await-smoke
// 目的: Next.js 16 で cookies() が async になっても 500 を起こさないことのスモーク

test.describe('www/login >> cookies-await-smoke', () => {
  test('GET /www/login returns 200-ish and not 500', async ({ page }) => {
    const response = await page.goto(`${DOMAINS.WWW}/login`);
    expect(response).toBeTruthy();
    const status = response!.status();
    // HTTPステータスコードが200番台または300番台であることを確認
    expect(status).toBeGreaterThanOrEqual(200);
    expect(status).toBeLessThan(400);
    // ログインフォームが表示されていることを確認
    await expect(page.getByRole('button', { name: /ログイン|login/i })).toBeVisible();
  });
});
