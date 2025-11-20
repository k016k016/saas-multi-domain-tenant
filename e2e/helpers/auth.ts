import { Page } from '@playwright/test';
import { DOMAINS } from './domains';

export async function uiLogin(page: Page, email: string, password: string) {
  await page.goto(`${DOMAINS.WWW}/login`);
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: /sign in|login|サインイン/i }).click();
  // サインイン成功後はAPPドメインにリダイレクトされる
  // CI環境を考慮してタイムアウトを60秒に延長し、ネットワークが安定するまで待機
  await page.waitForURL(new RegExp(`${DOMAINS.APP}/?`), {
    timeout: 60_000,
    waitUntil: 'networkidle',
  });
}
