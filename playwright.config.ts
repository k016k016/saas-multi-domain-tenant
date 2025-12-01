import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.test' });

const CI = !!process.env.CI;
const WWW_URL = process.env.NEXT_PUBLIC_WWW_URL ?? 'http://www.local.test:3001';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://app.local.test:3002';
const ADMIN_URL = process.env.NEXT_PUBLIC_ADMIN_URL ?? 'http://admin.local.test:3003';
const OPS_URL = process.env.NEXT_PUBLIC_OPS_URL ?? 'http://ops.local.test:3004';
const HOST_RESOLVER_RULE =
  'MAP *.local.test 127.0.0.1,MAP local.test 127.0.0.1,MAP *.local.test ::1,MAP local.test ::1';

type WebServerConfig = {
  name: 'www' | 'app' | 'admin' | 'ops';
  command: string;
  url: string;
};

const baseWebServers: WebServerConfig[] = [
  { name: 'www', command: 'pnpm --filter www start', url: 'http://localhost:3001' },
  { name: 'app', command: 'pnpm --filter app start', url: 'http://localhost:3002' },
  { name: 'admin', command: 'pnpm --filter admin start', url: 'http://localhost:3003' },
  // /login is a public route that returns 200 even though / returns 404 by design.
  { name: 'ops', command: 'pnpm --filter ops start', url: 'http://localhost:3004/login' },
];

const ciWebServers = baseWebServers.filter((server) => server.name !== 'ops');
const effectiveWebServers = CI ? ciWebServers : baseWebServers;

export default defineConfig({
  testDir: './e2e/tests',
  timeout: CI ? 60_000 : 30_000, // CI環境では60秒に延長
  expect: { timeout: CI ? 15_000 : 10_000 },
  workers: CI ? 1 : undefined, // CI: 直列、ローカル: 並列（ユーザー分離済み）
  reporter: CI ? 'github' : [['list'], ['html', { open: 'never' }]],
  globalTeardown: './playwright.global-teardown.ts',
  use: {
    trace: CI ? 'retain-on-failure' : 'on-first-retry', // CI環境では失敗時にtrace保存
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    navigationTimeout: CI ? 30_000 : 20_000, // CI環境では30秒に延長
    launchOptions: {
      args: [`--host-resolver-rules=${HOST_RESOLVER_RULE}`],
    },
  },
  webServer: effectiveWebServers.map(({ command, url }) => ({
    command,
    url,
    reuseExistingServer: !CI,
    timeout: 120_000,
  })),
  projects: [
    // Phase 1: 基盤テスト（chromium のみ - Firefox は安定性の問題により除外）
    {
      name: 'p1-chromium',
      testMatch: /e2e\/tests\/p1-baseline\/.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    // Firefox テストは一時的に無効化（安定性の問題のため）
    // {
    //   name: 'p1-firefox',
    //   testMatch: /e2e\/tests\/p1-baseline\/.*\.spec\.ts/,
    //   use: { ...devices['Desktop Firefox'] },
    //   retries: 1,
    // },
    // Phase 2: 新機能テスト（chromium のみ - Firefox は安定性の問題により除外）
    // P2はowner権限テストがあるため直列実行（owner1を複数ファイルで共有）
    {
      name: 'p2-chromium',
      testMatch: /e2e\/tests\/p2-members-audit\/.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
      fullyParallel: false,
    },
    // Firefox テストは一時的に無効化（安定性の問題のため）
    // {
    //   name: 'p2-firefox',
    //   testMatch: /e2e\/tests\/p2-members-audit\/.*\.spec\.ts/,
    //   use: { ...devices['Desktop Firefox'] },
    //   retries: 1,
    // },
    // Phase 3: OPS組織管理テスト（chromium のみ）
    {
      name: 'p3-chromium',
      testMatch: /e2e\/tests\/p3-ops-orgs\/.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    // Phase 4: 境界系・回帰用E2E（chromium のみ）
    // 複数コンテキスト・複数uiLogin呼び出しのテストがあるためタイムアウト延長
    {
      name: 'p4-chromium',
      testMatch: /e2e\/tests\/p4-boundary\/.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
      timeout: 45_000, // デフォルト30秒→45秒
    },
    // Phase 5: セキュリティ/意地悪テスト
    {
      name: 'p5-chromium',
      testMatch: /e2e\/tests\/p5-security\/.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
      fullyParallel: false,
    },
    // 旧プロジェクト定義（互換性のため残す）
    { name: 'www', use: { baseURL: WWW_URL, ...devices['Desktop Chrome'] } },
    { name: 'app', use: { baseURL: APP_URL, ...devices['Desktop Chrome'] } },
    { name: 'admin', use: { baseURL: ADMIN_URL, ...devices['Desktop Chrome'] } },
    { name: 'ops', use: { baseURL: OPS_URL, ...devices['Desktop Chrome'] } },
  ],
});
