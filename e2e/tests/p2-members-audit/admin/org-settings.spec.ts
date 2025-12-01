import { test, expect } from '@playwright/test';
import { DOMAINS } from '../../../helpers/domains';
import { uiLogin } from '../../../helpers/auth';
import { resetUserToOrg1, getSupabaseAdmin } from '../../../helpers/db';

// owner権限テスト用: owner1を使用（DB制約により各組織ownerは1人のみ）
const ADMIN = { email: 'admin1@example.com' };
const OWNER = { email: 'owner1@example.com' };
const MEMBER = { email: 'member4@example.com' };
const PASSWORD = process.env.E2E_TEST_PASSWORD!;

// owner1を共有するため、このファイルのテストは直列実行
test.describe.configure({ mode: 'serial' });

test.describe('/org-settings アクセス制限', () => {
  // 各テスト前にmember1をorg1（member権限）にリセット
  test.beforeEach(async () => {
    await resetUserToOrg1(MEMBER.email);
  });

  test('owner → 組織設定ページにアクセス可能', async ({ page }) => {
    await uiLogin(page, OWNER.email, PASSWORD);
    await page.goto(`${DOMAINS.ADMIN}/org-settings`);

    // ページが表示される
    await expect(page.getByRole('heading', { name: /組織設定/i })).toBeVisible();
  });

  test('admin → 組織設定ページにアクセス不可（/unauthorizedへリダイレクト）', async ({ page }) => {
    await uiLogin(page, ADMIN.email, PASSWORD);

    const response = await page.goto(`${DOMAINS.ADMIN}/org-settings`);
    await expect(page).toHaveURL(new RegExp(`${DOMAINS.ADMIN}/unauthorized`));
    await expect(page.getByRole('heading', { name: /アクセス権限がありません/i })).toBeVisible();
    expect(response?.status()).toBe(200);
  });

  test('member → 組織設定ページにアクセス不可（/unauthorizedへリダイレクト）', async ({ page }) => {
    await uiLogin(page, MEMBER.email, PASSWORD);

    const response = await page.goto(`${DOMAINS.ADMIN}/org-settings`);
    await expect(page).toHaveURL(new RegExp(`${DOMAINS.ADMIN}/unauthorized`));
    await expect(page.getByRole('heading', { name: /アクセス権限がありません/i })).toBeVisible();
    expect(response?.status()).toBe(200);
  });
});

test.describe('/org-settings 機能テスト', () => {
  test.beforeEach(async () => {
    const supabase = getSupabaseAdmin();

    await resetUserToOrg1(OWNER.email);

    // 組織を必ずアクティブ状態にリセット（前のテストの影響を排除）
    await supabase
      .from('organizations')
      .update({ is_active: true })
      .eq('slug', 'acme');
  });

  test('owner → 組織凍結・解除が成功する', async ({ page }) => {
    await uiLogin(page, OWNER.email, PASSWORD);
    await page.goto(`${DOMAINS.ADMIN}/org-settings`);

    // 理由入力
    await page.locator('input[placeholder*="理由"]').fill('テスト凍結');

    // 凍結ボタンをクリック
    await page.getByRole('button', { name: /組織を凍結/i }).click();

    // 確認ダイアログで実行
    await page.getByRole('button', { name: /実行/i }).click();

    // 成功メッセージ
    await expect(page.getByText(/成功/i)).toBeVisible({ timeout: 5000 });

    // DBで確認
    const supabase = getSupabaseAdmin();
    const { data } = await supabase
      .from('organizations')
      .select('is_active')
      .eq('slug', 'acme')
      .single();
    expect(data?.is_active).toBe(false);

    // 解除ボタンが表示される
    await expect(page.getByRole('button', { name: /凍結解除/i })).toBeVisible();

    // 解除
    await page.getByRole('button', { name: /凍結解除/i }).click();
    await expect(page.getByText(/成功/i)).toBeVisible({ timeout: 5000 });

    // Supabaseのレプリケーションラグを考慮して少し待機
    await page.waitForTimeout(1000);

    // DBで確認（新しいクライアントインスタンスを作成）
    const supabase2 = getSupabaseAdmin();
    const { data: data2 } = await supabase2
      .from('organizations')
      .select('is_active')
      .eq('slug', 'acme')
      .single();
    expect(data2?.is_active).toBe(true);
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

  test('owner → 組織廃止の確認が正しく動作する', async ({ page }) => {
    await uiLogin(page, OWNER.email, PASSWORD);
    await page.goto(`${DOMAINS.ADMIN}/org-settings`);

    // 誤った組織名を入力
    await page.locator('input[placeholder*="組織名"]').fill('wrong-name');

    // 廃止ボタンをクリック
    await page.getByRole('button', { name: /組織を廃止/i }).click();

    // エラーメッセージが表示される
    await expect(page.getByText(/組織名が一致しません/i)).toBeVisible({ timeout: 5000 });
  });
});
