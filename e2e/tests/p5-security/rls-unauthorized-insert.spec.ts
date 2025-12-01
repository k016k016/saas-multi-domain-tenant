/**
 * RLSテスト: 不正なINSERT操作の検証
 *
 * member6（org1所属）が任意のuser_id/org_idでprofilesをINSERTできないことを検証。
 */
import { test, expect } from '@playwright/test';
import { uiLogin } from '../../helpers/auth';
import { ORG_IDS } from '../../helpers/db';

const MEMBER6 = { email: 'member6@example.com' };
const PASSWORD = process.env.E2E_TEST_PASSWORD!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

test.describe('RLS unauthorized INSERT prevention', () => {
  test('認証ユーザーが任意org_idでprofilesをINSERTできない', async ({ page }) => {
    await uiLogin(page, MEMBER6.email, PASSWORD);

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

    // 偽のuser_idとorg_idでprofilesにINSERTを試みる
    const fakeUserId = '00000000-0000-0000-0000-000000000999';
    const response = await page.request.fetch(
      `${SUPABASE_URL}/rest/v1/profiles`,
      {
        method: 'POST',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: accessToken ? `Bearer ${accessToken}` : `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        data: JSON.stringify({
          user_id: fakeUserId,
          org_id: ORG_IDS.PRIMARY,
          role: 'admin', // 不正に管理者権限を付与しようとする
        }),
      }
    );

    // RLSが正しく機能していれば、403/401/409などが返る
    expect([401, 403, 409]).toContain(response.status());
  });

  test('認証ユーザーが他orgにprofilesをINSERTできない', async ({ page }) => {
    await uiLogin(page, MEMBER6.email, PASSWORD);

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

    // member6のuser_idを使い、所属していないorg2にINSERTを試みる
    // （実際のuser_idは不明なので偽のIDを使用）
    const response = await page.request.fetch(
      `${SUPABASE_URL}/rest/v1/profiles`,
      {
        method: 'POST',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: accessToken ? `Bearer ${accessToken}` : `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        data: JSON.stringify({
          user_id: '00000000-0000-0000-0000-000000000998',
          org_id: ORG_IDS.SECONDARY, // member6はorg2に所属していない
          role: 'member',
        }),
      }
    );

    // RLSが正しく機能していれば拒否される
    expect([401, 403, 409]).toContain(response.status());
  });
});
