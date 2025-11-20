import { test, expect } from '@playwright/test';
import { DOMAINS } from '../../helpers/domains';
import { uiLogin } from '../../helpers/auth';

// テストユーザー（seed-test-userで作成）
const OPS_USER = { email: 'ops1@example.com' };
const MEMBER_USER = { email: 'member1@example.com' };
const ADMIN_USER = { email: 'admin1@example.com' };
const OWNER_USER = { email: 'owner1@example.com' };
const PASSWORD = process.env.E2E_TEST_PASSWORD!;

test.describe('ops - アクセス制御', () => {
  test('ops1 → opsドメイン / にアクセス可能', async ({ page }) => {
    await uiLogin(page, OPS_USER.email, PASSWORD);
    await page.goto(`${DOMAINS.OPS}`);

    // opsコンソールのホームページが表示される
    await expect(page.getByRole('heading', { name: /Ops コンソール/i })).toBeVisible();
    await expect(page.getByText(/Internal Only \/ Ops Only/i)).toBeVisible();
  });

  test('ops1 → ops専用ログインページからログイン可能', async ({ page }) => {
    // ops専用ログインページに直接アクセス
    await page.goto(`${DOMAINS.OPS}/login`);
    await expect(page.getByTestId('ops-login-page-ready')).toBeVisible();
    await expect(page.getByRole('heading', { name: /OPS管理コンソール/i })).toBeVisible();

    // ログイン実行
    await page.locator('input#email').fill(OPS_USER.email);
    await page.locator('input#password').fill(PASSWORD);
    await page.getByRole('button', { name: /OPSサインイン/i }).click();

    // ログイン成功 → opsドメインのホームページへ
    await expect(page).toHaveURL(new RegExp(`${DOMAINS.OPS}/?$`));
    await expect(page.getByRole('heading', { name: /Ops コンソール/i })).toBeVisible();
  });

  test('ops1 → 通常組織（acme）にもadminとしてアクセス可能', async ({ page }) => {
    await uiLogin(page, OPS_USER.email, PASSWORD);

    // app.local.test:3002 へアクセス（Test Organization = acme）
    await page.goto(`${DOMAINS.APP}`);

    // ダッシュボードが表示される（adminロールでアクセス可能）
    await expect(page.getByRole('heading', { name: /ダッシュボード/i })).toBeVisible();
  });

  test('member1 → opsドメイン / にアクセス不可（404）', async ({ page }) => {
    await uiLogin(page, MEMBER_USER.email, PASSWORD);
    await page.goto(`${DOMAINS.OPS}`);

    // 404が表示される（notFound()により）
    await expect(page.locator('body')).toContainText(/404|Not Found/i);
  });

  test('admin1 → opsドメイン / にアクセス不可（404）', async ({ page }) => {
    await uiLogin(page, ADMIN_USER.email, PASSWORD);
    await page.goto(`${DOMAINS.OPS}`);

    // 404が表示される
    await expect(page.locator('body')).toContainText(/404|Not Found/i);
  });

  test('owner1 → opsドメイン / にアクセス不可（404）', async ({ page }) => {
    await uiLogin(page, OWNER_USER.email, PASSWORD);
    await page.goto(`${DOMAINS.OPS}`);

    // 404が表示される
    await expect(page.locator('body')).toContainText(/404|Not Found/i);
  });

  test('未ログインユーザー → opsドメインにアクセス → 404', async ({ page }) => {
    // ログインせずにopsドメインにアクセス
    const response = await page.goto(`${DOMAINS.OPS}`);

    // 404が返される（middleware、opsドメインは非公開）
    expect(response?.status()).toBe(404);
  });

  test('member1 → opsドメイン /orgs/new にアクセス不可（404）', async ({ page }) => {
    await uiLogin(page, MEMBER_USER.email, PASSWORD);
    await page.goto(`${DOMAINS.OPS}/orgs/new`);

    // 404が表示される（ホームページでops権限チェックされる前に、/orgs/newでも拒否される想定）
    // 実際はホームページで弾かれるため、このURLにも到達できない
    await expect(page.locator('body')).toContainText(/404|Not Found/i);
  });
});

test.describe('ops - OPS System Organization', () => {
  test('ops1はOPS System Organizationのメンバーである', async ({ page }) => {
    // この仕様の確認：
    // - ops1は固定UUID (00000000-0000-0000-0000-000000000099) のOPS組織のメンバー
    // - isOpsUser()はこのメンバーシップでtrue/falseを判定
    // - OPS組織はslug 'ops-system'を持つ特別な組織

    await uiLogin(page, OPS_USER.email, PASSWORD);

    // ops1がopsドメインにアクセスできることで、OPS組織メンバーシップが有効であることを確認
    await page.goto(`${DOMAINS.OPS}`);
    await expect(page.getByRole('heading', { name: /Ops コンソール/i })).toBeVisible();

    // OPS組織は通常組織と同じテーブルに存在し、app/adminドメインからもアクセス可能
    // （意図的に許可されている）
    // ただし、このE2Eテストではslugによるサブドメインルーティングは未実装のため、
    // 直接確認はしない。仕様として記録のみ。
  });

  test('ops1は複数組織にメンバーシップを持つ', async ({ page }) => {
    // ops1のprofilesレコード:
    // 1. OPS System Organization (UUID: ...99) - owner
    // 2. Test Organization (UUID: ...01, slug: acme) - admin

    await uiLogin(page, OPS_USER.email, PASSWORD);

    // 1. OPSドメインにアクセス可能（OPS組織メンバー）
    await page.goto(`${DOMAINS.OPS}`);
    await expect(page.getByRole('heading', { name: /Ops コンソール/i })).toBeVisible();

    // 2. 通常組織（acme）にもアクセス可能（adminロール）
    await page.goto(`${DOMAINS.APP}`);
    await expect(page.getByRole('heading', { name: /ダッシュボード/i })).toBeVisible();
  });
});

test.describe('ops - ログイン設計の仕様', () => {
  test('ops専用ログインページは非公開URL', async ({ page }) => {
    // ops/loginは知っている人のみがアクセスする隠れたエントリーポイント
    // 一般ユーザーはこのURLを知らない

    await page.goto(`${DOMAINS.OPS}/login`);
    await expect(page.getByTestId('ops-login-page-ready')).toBeVisible();
    await expect(page.getByText(/管理者専用サインイン/i)).toBeVisible();

    // このページは通常のwww/loginとは異なるデザイン（紫系）
    const background = await page.locator('div[data-testid="ops-login-page-ready"]').evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });

    // 背景色が紫系であることを確認（rgb(30, 27, 75) = #1e1b4b）
    expect(background).toContain('rgb(30, 27, 75)');
  });

  test('未認証でopsドメインにアクセス → 404（非公開ドメイン）', async ({ page }) => {
    // middlewareの設計:
    // - 未認証者は 404
    // - opsドメインは非公開、一般ユーザーへの導線は不要
    // - ops関係者は直接 ops/login にアクセスする

    const response = await page.goto(`${DOMAINS.OPS}/orgs/new`);

    // 404が返される
    expect(response?.status()).toBe(404);
  });

  test('ops/loginでログイン成功 → opsドメインへリダイレクト', async ({ page }) => {
    await page.goto(`${DOMAINS.OPS}/login`);

    await page.locator('input#email').fill(OPS_USER.email);
    await page.locator('input#password').fill(PASSWORD);
    await page.getByRole('button', { name: /OPSサインイン/i }).click();

    // 成功時は DOMAINS.OPS へリダイレクト（appドメインではない）
    await expect(page).toHaveURL(new RegExp(`${DOMAINS.OPS}/?$`));
    await expect(page.getByRole('heading', { name: /Ops コンソール/i })).toBeVisible();
  });
});
