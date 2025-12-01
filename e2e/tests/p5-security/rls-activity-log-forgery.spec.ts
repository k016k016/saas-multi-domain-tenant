/**
 * RLSテスト: activity_logsへの偽造ログINSERT検証
 *
 * admin2（org2のみ所属）が偽のuser_idでactivity_logsにログを偽造できないことを検証。
 */
import { test, expect } from '@playwright/test';
import { uiLogin } from '../../helpers/auth';
import { ORG_IDS } from '../../helpers/db';

const ADMIN2 = { email: 'admin2@example.com' };
const PASSWORD = process.env.E2E_TEST_PASSWORD!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

test.describe('RLS activity_log forgery prevention', () => {
  test('認証ユーザーが偽user_idでactivity_logsをINSERTできない', async ({ page }) => {
    await uiLogin(page, ADMIN2.email, PASSWORD);

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

    // 偽のuser_idでactivity_logsにINSERTを試みる
    const fakeUserId = '00000000-0000-0000-0000-000000000001'; // owner1のIDを偽装
    const response = await page.request.fetch(
      `${SUPABASE_URL}/rest/v1/activity_logs`,
      {
        method: 'POST',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: accessToken ? `Bearer ${accessToken}` : `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        data: JSON.stringify({
          org_id: ORG_IDS.PRIMARY, // admin2は所属していないorg
          user_id: fakeUserId,
          action: 'member.invited',
          payload: { forged: true, email: 'hacker@evil.com' },
        }),
      }
    );

    // RLSが正しく機能していれば、403/401が返る
    // activity_logsはイミュータブルなので、不正なINSERTは拒否されるべき
    expect([401, 403]).toContain(response.status());
  });

  test('認証ユーザーが他orgのactivity_logsをINSERTできない', async ({ page }) => {
    await uiLogin(page, ADMIN2.email, PASSWORD);

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

    // admin2の正当なuser_idを使うが、所属していないorg1に対してINSERTを試みる
    const response = await page.request.fetch(
      `${SUPABASE_URL}/rest/v1/activity_logs`,
      {
        method: 'POST',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: accessToken ? `Bearer ${accessToken}` : `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        data: JSON.stringify({
          org_id: ORG_IDS.PRIMARY, // admin2はorg1に所属していない
          user_id: '1f3f6125-8bdc-489e-b79f-17ffe82f3b80', // admin2の実際のID
          action: 'org.settings.updated',
          payload: { malicious: true },
        }),
      }
    );

    // 他orgへのログ偽造は拒否されるべき
    expect([401, 403]).toContain(response.status());
  });
});
