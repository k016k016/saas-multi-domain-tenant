import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.test' });

const CI = !!process.env.CI;
const WWW_URL = process.env.NEXT_PUBLIC_WWW_URL ?? 'http://www.local.test:3001';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://app.local.test:3002';
const ADMIN_URL = process.env.NEXT_PUBLIC_ADMIN_URL ?? 'http://admin.local.test:3003';
const OPS_URL = process.env.NEXT_PUBLIC_OPS_URL ?? 'http://ops.local.test:3004';

export default defineConfig({
  testDir: './e2e/tests',
  timeout: CI ? 60_000 : 30_000, // CI環境では60秒に延長
  expect: { timeout: CI ? 15_000 : 10_000 },
  workers: CI ? 2 : undefined,
  reporter: CI ? 'github' : [['list'], ['html', { open: 'never' }]],
  use: {
    trace: CI ? 'retain-on-failure' : 'on-first-retry', // CI環境では失敗時にtrace保存
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    navigationTimeout: CI ? 30_000 : 20_000, // CI環境では30秒に延長
  },
  webServer: CI ? [
    { command: 'pnpm --filter www start', url: 'http://localhost:3001', reuseExistingServer: true, timeout: 120_000 },
    { command: 'pnpm --filter app start', url: 'http://localhost:3002', reuseExistingServer: true, timeout: 120_000 },
    { command: 'pnpm --filter admin start', url: 'http://localhost:3003', reuseExistingServer: true, timeout: 120_000 },
    { command: 'pnpm --filter ops start', url: 'http://localhost:3004', reuseExistingServer: true, timeout: 120_000 },
  ] : undefined,
  projects: [
    { name: 'www', use: { baseURL: WWW_URL, ...devices['Desktop Chrome'] } },
    { name: 'app', use: { baseURL: APP_URL, ...devices['Desktop Chrome'] } },
    { name: 'admin', use: { baseURL: ADMIN_URL, ...devices['Desktop Chrome'] } },
    { name: 'ops', use: { baseURL: OPS_URL, ...devices['Desktop Chrome'] } },
  ],
});
