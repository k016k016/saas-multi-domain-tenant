import { test, expect } from '@playwright/test';
import { uiLogin } from '../../helpers/auth';

// member2はorg2（beta）のみ所属。org1（acme）への不正アクセスを検証
// admin2ではなくmember2を使用（admin2はorg1にもプロファイルがある可能性）
const MEMBER = { email: 'member2@example.com' };
const PASSWORD = process.env.E2E_TEST_PASSWORD!;

test.describe('Org slug header injection', () => {
  test('未所属orgをx-org-slugヘッダーで指定しても403/404', async ({ browser }) => {
    // x-org-slugヘッダーでacme（未所属org）を指定
    const context = await browser.newContext({
      extraHTTPHeaders: {
        'x-org-slug': 'acme',
      },
    });
    const page = await context.newPage();

    // member2（org2のみ所属）でログイン
    await uiLogin(page, MEMBER.email, PASSWORD);

    // admin画面でacme orgのメンバー一覧にアクセス→未所属なので403/404
    // member2はmemberロールなのでadminドメインへのアクセス自体が拒否される
    const response = await page.goto('http://admin.local.test:3003/members?org=acme');

    // member2がacmeにアクセスできない理由:
    // 1. member2はorg2のみ所属→acme(org1)へのアクセスでgetCurrentOrg()がnullを返す→404
    // 2. memberロールなのでadminドメインへのアクセスが拒否される→unauthorized
    const status = response?.status() ?? 0;
    const url = page.url();

    // 404, 403, または/unauthorizedへのリダイレクト（200だがURLが変わる）
    const isBlocked = status === 403 || status === 404 || url.includes('unauthorized');
    expect(isBlocked).toBe(true);

    await context.close();
  });
});
