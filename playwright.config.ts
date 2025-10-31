import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.test' });

const WWW_URL = process.env.WWW_URL ?? 'http://www.local.test:3001';
const APP_URL = process.env.APP_URL ?? 'http://app.local.test:3002';
const ADMIN_URL = process.env.ADMIN_URL ?? 'http://admin.local.test:3003';
const OPS_URL = process.env.OPS_URL ?? 'http://ops.local.test:3004';

export default defineConfig({
  testDir: './e2e/tests',
  timeout: 30_000,
  fullyParallel: true,
  reporter: [['list'], ['html', { open: 'never' }]],
  expect: { timeout: 5_000 },
  use: {
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    navigationTimeout: 20_000, // ページ遷移タイムアウト（ログイン後の遷移など）
  },
  projects: [
    { name: 'www', use: { baseURL: WWW_URL, ...devices['Desktop Chrome'] } },
    { name: 'app', use: { baseURL: APP_URL, ...devices['Desktop Chrome'] } },
    { name: 'admin', use: { baseURL: ADMIN_URL, ...devices['Desktop Chrome'] } },
    { name: 'ops', use: { baseURL: OPS_URL, ...devices['Desktop Chrome'] } },
  ],
});
