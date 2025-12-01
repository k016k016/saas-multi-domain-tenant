/**
 * Owner権限譲渡テスト
 *
 * P2から移動：owner1@example.comが複数ファイルで並列使用されるため、
 * P5で単独実行して競合を回避。
 */
import { test, expect } from '@playwright/test';
import { DOMAINS } from '../../helpers/domains';
import { uiLogin } from '../../helpers/auth';
import { resetUserToOrg1, getSupabaseAdmin } from '../../helpers/db';

// owner権限テスト用: owner1を使用（DB制約により各組織ownerは1人のみ）
const ADMIN = { email: 'admin1@example.com' };
const OWNER = { email: 'owner1@example.com' };
const PASSWORD = process.env.E2E_TEST_PASSWORD!;

// このファイル内のテストは直列実行
test.describe.configure({ mode: 'serial' });

test.describe('Owner権限譲渡', () => {
  test.beforeEach(async () => {
    const supabase = getSupabaseAdmin();

    await resetUserToOrg1(OWNER.email);

    // 組織を必ずアクティブ状態にリセット
    await supabase
      .from('organizations')
      .update({ is_active: true })
      .eq('slug', 'acme');
  });

  test('owner → owner権限譲渡が成功する', async ({ page }) => {
    const supabase = getSupabaseAdmin();

    await uiLogin(page, OWNER.email, PASSWORD);
    await page.goto(`${DOMAINS.ADMIN}/org-settings`);

    // 組織IDを取得
    const { data: org } = await supabase.from('organizations').select('id').eq('slug', 'acme').single();
    const orgId = org!.id;

    // ユーザーIDを取得
    const { data: authUsers } = await supabase.auth.admin.listUsers();
    const ownerUser = authUsers.users.find(u => u.email === OWNER.email);
    const adminUser = authUsers.users.find(u => u.email === ADMIN.email);
    expect(adminUser).toBeDefined();

    // 元のowner確認
    const { data: beforeOwner } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', ownerUser!.id)
      .eq('org_id', orgId)
      .single();
    expect(beforeOwner?.role).toBe('owner');

    // セレクトボックスから「鈴木 花子 (admin)」= admin1@example.com を選択
    const selectOptions = await page.locator('select option').allTextContents();
    expect(selectOptions.length).toBeGreaterThan(1); // 選択肢が存在することを確認

    // user_idで選択
    await page.locator('select').first().selectOption({ value: adminUser!.id });

    // 選択されたvalueを取得
    const selectedValue = await page.locator('select').first().inputValue();
    expect(selectedValue).toBe(adminUser!.id);

    // 譲渡ボタン
    await page.getByRole('button', { name: /owner権限を譲渡/i }).click();

    // 確認ダイアログ
    await page.getByRole('button', { name: /譲渡する/i }).click();

    // /membersページにリダイレクトされることを確認
    await expect(page).toHaveURL(new RegExp(`${DOMAINS.ADMIN}/members`), { timeout: 5000 });

    // DBで確認: 旧ownerがadminに降格
    const { data: afterOldOwner } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', ownerUser!.id)
      .eq('org_id', orgId)
      .single();
    expect(afterOldOwner?.role).toBe('admin');

    // DBで確認: 新ownerがownerに昇格
    const { data: afterNewOwner } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', selectedValue)
      .eq('org_id', orgId)
      .single();
    expect(afterNewOwner?.role).toBe('owner');

    // ロールバック: 先に新ownerをadminに降格し、その後旧ownerをownerに戻す（DB制約を満たすため）
    await supabase
      .from('profiles')
      .update({ role: 'admin' })
      .eq('user_id', selectedValue)
      .eq('org_id', orgId);

    await supabase
      .from('profiles')
      .update({ role: 'owner' })
      .eq('user_id', ownerUser!.id)
      .eq('org_id', orgId);
  });
});
