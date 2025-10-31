import { Page } from '@playwright/test';
import { DOMAINS } from './domains';

export async function uiLogin(page: Page, email: string, password: string) {
  await page.goto(`${DOMAINS.WWW}/login`);
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: /sign in|login|ログイン/i }).click();
  // ログイン成功後はAPPドメインにリダイレクトされる
  await page.waitForURL(new RegExp(`${DOMAINS.APP}/?`));
}
