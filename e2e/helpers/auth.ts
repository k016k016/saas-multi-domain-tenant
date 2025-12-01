import { Page } from '@playwright/test';
import { DOMAINS } from './domains';

export async function uiLogin(page: Page, email: string, password: string) {
  await page.context().clearCookies();
  await page.goto(`${DOMAINS.WWW}/login`);

  for (let attempt = 1; attempt <= 3; attempt++) {
    await page.locator('#email').fill(email);
    await page.locator('#password').fill(password);
    await page.getByRole('button', { name: /sign in|login|サインイン/i }).click();

    try {
      await page.waitForURL((url) => {
        const currentUrl = typeof url === 'string' ? url : url.href;
        return currentUrl.startsWith(DOMAINS.APP);
      }, { timeout: 20_000 });
      return;
    } catch (error) {
      const invalidCredentials = await page
        .getByText(/メールアドレスまたはパスワードが無効|invalid login/i)
        .isVisible()
        .catch(() => false);

      if (!invalidCredentials) {
        // 認証は成功しているがクライアント遷移が完了していないケースに備え、
        // 明示的にAPPドメインへ遷移してCookieを有効化する。
        try {
          await page.goto(DOMAINS.APP, { waitUntil: 'domcontentloaded' });
          if (page.url().startsWith(DOMAINS.APP) || (await hasSupabaseSessionCookie(page))) {
            return;
          }
        } catch {
          // fallthrough to retry/throw logic below
        }
        if (await hasSupabaseSessionCookie(page)) {
          return;
        }
      }

      if (attempt === 3 || !invalidCredentials) {
        throw error;
      }

      // 軽いエラーの場合は少し待って再試行
      await page.waitForTimeout(1_000);
    }
  }
}

async function hasSupabaseSessionCookie(page: Page) {
  try {
    const cookies = await page.context().cookies();
    return cookies.some((cookie) =>
      cookie.name.startsWith('sb-') &&
      /access-token|refresh-token/i.test(cookie.name)
    );
  } catch {
    // コンテキスト破棄時（タイムアウト後など）はfalseを返す
    return false;
  }
}

export async function uiLogout(page: Page) {
  const logoutButton = page.getByRole('button', { name: /サインアウト/ });
  if ((await logoutButton.count()) > 0) {
    const button = logoutButton.first();
    await button.waitFor({ state: 'visible', timeout: 10_000 });
    await button.click();
    await page.waitForURL((url) => {
      const currentUrl = typeof url === 'string' ? url : url.href;
      return currentUrl.includes('www.local.test') && currentUrl.includes('login');
    }, { timeout: 20_000 });
    await page.context().clearCookies();
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    return;
  }

  // Fallback: ボタンがない場合はCookieクリアでサインアウト状態へ
  await page.context().clearCookies();
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.goto(`${DOMAINS.WWW}/login`);
}
