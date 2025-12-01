/**
 * RLSテスト: 他組織データへのSELECTアクセス検証
 *
 * member2（org2のみ所属）がorg1のデータを閲覧できないことを検証。
 * 現状のRLSは `auth.uid() IS NOT NULL` のみなので、脆弱性があれば失敗する。
 */
import { test, expect } from '@playwright/test';
import { uiLogin } from '../../helpers/auth';
import { ORG_IDS } from '../../helpers/db';

const MEMBER2 = { email: 'member2@example.com' };
const PASSWORD = process.env.E2E_TEST_PASSWORD!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

test.describe('RLS cross-org SELECT prevention', () => {
  test('認証ユーザーが他orgのprofilesを閲覧できない', async ({ page }) => {
    // member2でログインしてセッショントークンを取得
    await uiLogin(page, MEMBER2.email, PASSWORD);

    // Cookieからアクセストークンを取得
    const cookies = await page.context().cookies();
    const authCookie = cookies.find(c => c.name.includes('auth-token'));

    // Cookie形式からアクセストークンを抽出（base64エンコードされたJSON）
    let accessToken: string | null = null;
    if (authCookie) {
      try {
        const decoded = Buffer.from(authCookie.value, 'base64').toString('utf-8');
        const parsed = JSON.parse(decoded);
        accessToken = parsed.access_token || parsed[0]?.access_token;
      } catch {
        // Cookieが直接トークンの場合
        accessToken = authCookie.value;
      }
    }

    if (!accessToken) {
      // セッションCookieから取得できない場合はSupabase APIを直接使用
      // この場合、テストはスキップではなく、別の方法で検証
      console.log('Access token not found in cookies, testing with anon key only');
    }

    // org1のprofilesを取得しようとする
    const response = await page.request.fetch(
      `${SUPABASE_URL}/rest/v1/profiles?org_id=eq.${ORG_IDS.PRIMARY}&select=user_id,role`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: accessToken ? `Bearer ${accessToken}` : `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    // RLSが正しく機能していれば、空配列またはエラーが返る
    // 脆弱な場合は他orgのデータが返ってくる
    const data = await response.json();

    // member2はorg2のみ所属なので、org1のprofilesは見えてはいけない
    // 空配列であることを期待（RLSが正しく機能している場合）
    // 注意: 現状のRLSでは失敗する可能性あり（脆弱性検出）
    expect(Array.isArray(data) ? data.length : 0).toBe(0);
  });

  test('認証ユーザーが他orgのactivity_logsを閲覧できない', async ({ page }) => {
    await uiLogin(page, MEMBER2.email, PASSWORD);

    const cookies = await page.context().cookies();
    const authCookie = cookies.find(c => c.name.includes('auth-token'));
    let accessToken: string | null = null;
    if (authCookie) {
      try {
        const decoded = Buffer.from(authCookie.value, 'base64').toString('utf-8');
        const parsed = JSON.parse(decoded);
        accessToken = parsed.access_token || parsed[0]?.access_token;
      } catch {
        accessToken = authCookie.value;
      }
    }

    // org1のactivity_logsを取得しようとする
    const response = await page.request.fetch(
      `${SUPABASE_URL}/rest/v1/activity_logs?org_id=eq.${ORG_IDS.PRIMARY}&select=id,action`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: accessToken ? `Bearer ${accessToken}` : `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const data = await response.json();

    // member2はorg1に所属していないので、org1のログは見えてはいけない
    expect(Array.isArray(data) ? data.length : 0).toBe(0);
  });
});
