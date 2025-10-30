import { test, expect } from '@playwright/test';

// www/login >> cookies-await-smoke
// 目的: Next.js 16 で cookies() が async になっても 500 を起こさないことのスモーク

test.describe('www/login >> cookies-await-smoke', () => {
  test('GET /www/login returns 200-ish and not 500', async ({ page }) => {
    const response = await page.goto('/www/login');
    expect(response).toBeTruthy();
    const status = response!.status();
    expect(status).toBeGreaterThanOrEqual(200);
    expect(status).toBeLessThan(500);
    const content = await page.content();
    expect(content).not.toContain('500');
  });
});
