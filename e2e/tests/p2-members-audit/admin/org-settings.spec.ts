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

  // owner権限譲渡テストはP5に移動（並列実行でowner1が競合するため）
  // → e2e/tests/p5-security/owner-transfer.spec.ts

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
