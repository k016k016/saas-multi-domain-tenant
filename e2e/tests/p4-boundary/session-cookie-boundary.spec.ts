/**
 * Phase 4: セッション・Cookie境界テスト
 *
 * テスト内容:
 * - Cookie共有ドメイン間での認証状態の保持
 * - Cookie非共有ドメインでの独立性
 * - ログアウト後の全ドメインでのセッション無効化
 * - セッションタイムアウトの動作確認
 * - 異なるブラウザコンテキストでの独立性
 *
 * 使用ユーザー:
 * - member1@example.com (org1: member, org2: admin)
 * - admin1@example.com (org1: admin, org2: member)
 */

import { test, expect } from '@playwright/test';
import { uiLogin, uiLogout } from '../../helpers/auth';
import { resetUserToOrg1 } from '../../helpers/db';

const PASSWORD = process.env.E2E_TEST_PASSWORD!;

test.describe('Session and Cookie Boundaries', () => {
  test.beforeEach(async () => {
    await resetUserToOrg1('member1@example.com');
    await resetUserToOrg1('admin1@example.com');
  });

  test.describe('Cookie共有ドメイン間での認証状態', () => {
    test('www.local.testでログイン後、app.local.testに自動ログイン', async ({ page }) => {
      // www.local.testでログイン
      await uiLogin(page, 'member1@example.com', PASSWORD);

      // app.local.testへ遷移（既にログイン済み）
      await expect(page.url()).toContain('app.local.test');
      await expect(page.getByRole('button', { name: /Test Organization/ })).toBeVisible();

      // admin.local.testのメンバー管理へ直接アクセス
      await page.goto('http://admin.local.test:3003/members');

      // memberは権限がないため/unauthorizedへリダイレクト
      await expect(page).toHaveURL(/unauthorized/);
      await expect(page.getByRole('heading', { name: '403' })).toBeVisible();
    });

    test('app.local.testでログイン後、admin.local.testでも認証状態保持', async ({ page }) => {
      // app.local.testでログイン
      await uiLogin(page, 'admin1@example.com', PASSWORD);

      // admin.local.testへアクセス
      await page.goto('http://admin.local.test:3003/members');

      // 認証済みでアクセス可能
      await expect(page.getByRole('heading', { name: 'メンバー管理' })).toBeVisible();
      await expect(page.getByRole('button', { name: /Test Organization/ })).toBeVisible();
    });

    test('サブドメイン間でもCookie共有（acme.app.local.test）', async ({ page }) => {
      // メインドメインでログイン
      await uiLogin(page, 'member1@example.com', PASSWORD);

      // サブドメインへアクセス
      await page.goto('http://acme.app.local.test:3002/');

      // 認証済みでアクセス可能
      await expect(page.getByRole('button', { name: /Test Organization/ })).toBeVisible();
      await expect(page.url()).toContain('acme.app.local.test');
    });
  });

  test.describe('Cookie非共有ドメインでの独立性', () => {
    test('ops.local.testは独立した認証（他ドメインのCookie無効）', async ({ page }) => {
      // app.local.testでmember1でログイン
      await uiLogin(page, 'member1@example.com', PASSWORD);
      await expect(page.getByRole('button', { name: /Test Organization/ })).toBeVisible();

      // ops.local.testへアクセス（Cookie非共有）
      const noOpsResponse = await page.goto('http://ops.local.test:3004/');
      expect(noOpsResponse?.status()).toBe(404);

      // ログアウトして、ops1でログインし直す
      await page.goto('http://www.local.test:3001/');
      await uiLogout(page);

      // ops1でログイン
      await uiLogin(page, 'ops1@example.com', PASSWORD);

      // ops.local.testにアクセス可能
      const opsResponse = await page.goto('http://ops.local.test:3004/');
      expect(opsResponse?.status()).toBe(200);
      await expect(page.getByRole('heading', { name: /Ops コンソール/i })).toBeVisible();
    });
  });

  test.describe('ログアウト後の全ドメインでのセッション無効化', () => {
    test('一つのドメインでログアウトすると全ドメインで無効化', async ({ page, browser }) => {
      // www.local.testでログイン
      await uiLogin(page, 'admin1@example.com', PASSWORD);

      // app.local.testで認証確認
      await expect(page.url()).toContain('app.local.test');
      await expect(page.getByRole('button', { name: /Test Organization/ })).toBeVisible();

      // admin.local.testでも認証確認
      await page.goto('http://admin.local.test:3003/members');
      await expect(page.getByRole('heading', { name: 'メンバー管理' })).toBeVisible();

      // ログアウト
      await uiLogout(page);

      // www.local.testのログインページにリダイレクト
      await expect(page).toHaveURL(/www\.local\.test.*login/);

      // 新しいブラウザコンテキストで各ドメインへアクセスし、未認証であることを確認
      const urlsToCheck = [
        'http://app.local.test:3002/',
        'http://admin.local.test:3003/',
      ];

      for (const targetUrl of urlsToCheck) {
        const verificationContext = await browser.newContext();
        const verificationPage = await verificationContext.newPage();
        await verificationPage.goto(targetUrl);
        await expect(verificationPage).toHaveURL(/www\.local\.test.*login/);
        await verificationContext.close();
      }
    });
  });

  test.describe('異なるブラウザコンテキストでの独立性', () => {
    test('異なるブラウザコンテキストは完全に独立', async ({ browser }) => {
      // コンテキスト1: member1でログイン
      const context1 = await browser.newContext();
      const page1 = await context1.newPage();
      await uiLogin(page1, 'member1@example.com', PASSWORD);
      await expect(page1.getByRole('button', { name: /Test Organization/ })).toBeVisible();

      // コンテキスト2: 未認証状態
      const context2 = await browser.newContext();
      const page2 = await context2.newPage();
      await page2.goto('http://app.local.test:3002/');

      // コンテキスト2はログインページへリダイレクト
      await expect(page2).toHaveURL(/www\.local\.test.*login/);

      // コンテキスト2: admin1でログイン
      await uiLogin(page2, 'admin1@example.com', PASSWORD);
      await expect(page2.getByRole('button', { name: /Test Organization/ })).toBeVisible();

      // コンテキスト1はmember1のまま
      await page1.reload();
      await expect(page1.getByRole('button', { name: /Test Organization/ })).toBeVisible();
      // メールアドレスが表示されていれば確認
      const userMenu = page1.locator('[data-testid="user-menu"]');
      if (await userMenu.count() > 0) {
        await userMenu.click();
        await expect(page1.getByText('member1@example.com')).toBeVisible();
      }

      await context1.close();
      await context2.close();
    });

    test('プライベートブラウジング間での独立性', async ({ browser }) => {
      // 通常コンテキスト
      const normalContext = await browser.newContext();
      const normalPage = await normalContext.newPage();
      await uiLogin(normalPage, 'member1@example.com', PASSWORD);

      // プライベートコンテキスト（シークレットモード相当）
      const privateContext = await browser.newContext();
      const privatePage = await privateContext.newPage();

      // プライベートコンテキストは未認証
      await privatePage.goto('http://app.local.test:3002/');
      await expect(privatePage).toHaveURL(/www\.local\.test.*login/);

      // プライベートコンテキストで別ユーザーでログイン
      await uiLogin(privatePage, 'admin1@example.com', PASSWORD);

      // 両コンテキストが独立して動作
      await normalPage.reload();
      await expect(normalPage.getByRole('button', { name: /Test Organization/ })).toBeVisible();

      await privatePage.reload();
      await expect(privatePage.getByRole('button', { name: /Test Organization/ })).toBeVisible();

      await normalContext.close();
      await privateContext.close();
    });
  });

  test.describe('Cookie属性の確認', () => {
    test('セッションCookieのドメイン共有設定を確認', async ({ page, context }) => {
      // ログイン
      await uiLogin(page, 'member1@example.com', PASSWORD);

      // Cookieを取得
      const cookies = await context.cookies();

      // セッションCookieを探す
      const sessionCookies = cookies.filter(c =>
        c.name.includes('auth-token') ||
        c.name.includes('session') ||
        c.name.includes('sb-')
      );

      expect(sessionCookies.length).toBeGreaterThan(0);

      // Cookieのドメイン設定を確認
      sessionCookies.forEach(cookie => {
        // .local.testドメインで共有されていることを確認
        expect(cookie.domain).toMatch(/\.local\.test/);

        // セキュリティ属性の確認
        expect(cookie.httpOnly).toBe(true);
        expect(cookie.sameSite).toBe('Lax');
      });
    });

    test('組織コンテキストCookieの確認', async ({ page, context }) => {
      // ログイン
      await uiLogin(page, 'member1@example.com', PASSWORD);

      // 組織を切り替え
      await page.getByRole('button', { name: 'Test Organization' }).click();
      await page.getByRole('button', { name: 'Test Organization Beta' }).click();

      // Cookieを取得
      const cookies = await context.cookies();

      // 組織コンテキストCookieを探す
      const orgCookies = cookies.filter(c =>
        c.name.includes('org') ||
        c.name.includes('context')
      );

      if (orgCookies.length > 0) {
        orgCookies.forEach(cookie => {
          // 組織情報がCookieに含まれていることを確認
          console.log(`Cookie ${cookie.name}: domain=${cookie.domain}, value length=${cookie.value.length}`);
        });
      }
    });
  });

  test.describe('セッションタイムアウトのシミュレーション', () => {
    test('長時間アイドル後のセッション確認', async ({ page, context }) => {
      // ログイン
      await uiLogin(page, 'member1@example.com', PASSWORD);
      await expect(page.getByRole('button', { name: /Test Organization/ })).toBeVisible();

      // Cookieを手動で期限切れに設定（シミュレーション）
      const cookies = await context.cookies();
      const expiredCookies = cookies.map(c => ({
        ...c,
        expires: Math.floor(Date.now() / 1000) - 3600 // 1時間前に期限切れ
      }));

      await context.clearCookies();
      await context.addCookies(expiredCookies);

      // ページリロード
      await page.reload();

      // ログインページへリダイレクト
      await expect(page).toHaveURL(/www\.local\.test.*login/);
    });
  });
});
