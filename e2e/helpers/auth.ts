import { Page } from '@playwright/test';
import { DOMAINS } from './domains';

export async function uiLogin(page: Page, email: string, password: string) {
  await page.goto(`${DOMAINS.WWW}/login`);
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /sign in|login|ログイン/i }).click();
  await page.waitForURL(new RegExp(`${DOMAINS.WWW}/?`));
}
