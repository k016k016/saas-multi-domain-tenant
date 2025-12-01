import { test, expect } from '@playwright/test';
import { ORG_IDS } from '../../helpers/db';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

test.describe('RLS hardening for activity_logs', () => {
  test('匿名APIから activity_logs へINSERT不可', async () => {
    expect(SUPABASE_URL, 'NEXT_PUBLIC_SUPABASE_URL is required').toBeTruthy();
    expect(SUPABASE_ANON_KEY, 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required').toBeTruthy();

    const response = await fetch(`${SUPABASE_URL}/rest/v1/activity_logs`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY!,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        org_id: ORG_IDS.PRIMARY,
        user_id: '00000000-0000-0000-0000-000000000099',
        action: 'org.frozen',
        payload: { injected: true },
      }),
    });

    expect([401, 403]).toContain(response.status);
  });
});
