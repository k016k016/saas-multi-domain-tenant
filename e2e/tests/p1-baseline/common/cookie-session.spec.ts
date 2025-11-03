import { test, expect } from '@playwright/test';
import { DOMAINS } from '../../../helpers/domains';
import { uiLogin } from '../../../helpers/auth';
import { resetUserToOrg1 } from '../../../helpers/db';

const MEMBER = { email: 'member1@example.com' };
const PASSWORD = process.env.E2E_TEST_PASSWORD!;

test.describe('Cookie・セッション管理', () => {
  // 各テスト前にmember1をorg1（member権限）にリセット
  // これにより他のテスト（特にorg-switching.spec.ts）による状態汚染を防ぐ
  test.beforeEach(async () => {
    await resetUserToOrg1(MEMBER.email);
  });
  test('ログイン → Supabase Session Cookieの保持確認', async ({ page, context }) => {
    // ログイン前のCookieを確認（セッションCookieが無いはず）
    const cookiesBeforeLogin = await context.cookies();
    const sessionCookieBeforeLogin = cookiesBeforeLogin.find(c => c.name.startsWith('sb-'));
    expect(sessionCookieBeforeLogin).toBeUndefined();

    // ログイン
    await uiLogin(page, MEMBER.email, PASSWORD);
    await page.goto(`${DOMAINS.APP}`);

    // ログイン後のCookieを確認
    const cookiesAfterLogin = await context.cookies();

    // Supabase Session Cookie (sb-*) が存在することを確認
    const sessionCookie = cookiesAfterLogin.find(c => c.name.startsWith('sb-'));
    expect(sessionCookie).toBeTruthy();
    expect(sessionCookie?.name).toMatch(/^sb-/);

    // Cookie の domain が .local.test であることを確認（マルチドメイン共有のため）
    expect(sessionCookie?.domain).toMatch(/\.local\.test/);
  });

  test('ドメイン間でのCookie共有確認', async ({ page, context }) => {
    // www.local.testでログイン
    await uiLogin(page, MEMBER.email, PASSWORD);

    // app.local.testでもログイン状態であることを確認
    await page.goto(`${DOMAINS.APP}`);
    await expect(page).toHaveURL(new RegExp(`${DOMAINS.APP}`));
    await expect(page).not.toHaveURL(new RegExp(`${DOMAINS.WWW}/login`));

    // admin.local.testでもセッションが共有されていることを確認
    // (memberはadminにアクセスできないが、認証自体は通っている)
    await page.goto(`${DOMAINS.ADMIN}/members`);

    // memberは/unauthorizedにリダイレクトされるはず（認証は通っているが権限不足）
    await expect(page).toHaveURL(new RegExp(`${DOMAINS.ADMIN}/unauthorized`));
    // ログインページにリダイレクトされない（セッションが共有されている証拠）
    await expect(page).not.toHaveURL(new RegExp(`${DOMAINS.WWW}/login`));
  });
});
