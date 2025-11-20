import { test, expect } from '@playwright/test';
import { DOMAINS } from '../../helpers/domains';
import { uiLogin } from '../../helpers/auth';
import { getSupabaseAdmin } from '@repo/db';

// OPS管理者ユーザー（seed-test-userで作成）
const OPS_USER = { email: 'ops1@example.com' };
const PASSWORD = process.env.E2E_TEST_PASSWORD!;

test.describe('ops/orgs/new - 組織作成', () => {
  test('ops管理者 → /orgs/new にアクセス可能', async ({ page }) => {
    await uiLogin(page, OPS_USER.email, PASSWORD);
    await page.goto(`${DOMAINS.OPS}/orgs/new`);

    await expect(page.getByRole('heading', { name: /新規組織作成/i })).toBeVisible();
  });

  test('ops管理者 → 組織作成フォームが表示される', async ({ page }) => {
    await uiLogin(page, OPS_USER.email, PASSWORD);
    await page.goto(`${DOMAINS.OPS}/orgs/new`);

    // フォームの各フィールドが表示される
    await expect(page.locator('input#org-name')).toBeVisible();
    await expect(page.locator('input#org-slug')).toBeVisible();
    await expect(page.locator('input#owner-name')).toBeVisible();
    await expect(page.locator('input#owner-email')).toBeVisible();
    await expect(page.locator('input#owner-password')).toBeVisible();
    await expect(page.locator('input#owner-password-confirm')).toBeVisible();
    await expect(page.getByRole('button', { name: /組織を作成/i })).toBeVisible();
  });

  test('ops管理者 → スラッグの自動変換が動作する', async ({ page }) => {
    await uiLogin(page, OPS_USER.email, PASSWORD);
    await page.goto(`${DOMAINS.OPS}/orgs/new`);

    // 大文字や記号を入力
    await page.locator('input#org-slug').fill('Test-Org_123!@#');

    // 小文字と英数字・ハイフンのみに変換される（アンダースコアと記号は削除）
    const value = await page.locator('input#org-slug').inputValue();
    expect(value).toBe('test-org123');
  });

  test('ops管理者 → 組織作成が成功する', async ({ page }) => {
    await uiLogin(page, OPS_USER.email, PASSWORD);
    await page.goto(`${DOMAINS.OPS}/orgs/new`);

    // ユニークなスラッグを生成
    const timestamp = Date.now();
    const orgSlug = `test-org-${timestamp}`;
    const ownerEmail = `owner-${timestamp}@example.com`;

    // フォームに入力
    await page.locator('input#org-name').fill('テスト組織');
    await page.locator('input#org-slug').fill(orgSlug);
    await page.locator('input#owner-name').fill('テストオーナー');
    await page.locator('input#owner-email').fill(ownerEmail);
    await page.locator('input#owner-password').fill(PASSWORD);
    await page.locator('input#owner-password-confirm').fill(PASSWORD);

    // 作成ボタンをクリック
    await page.getByRole('button', { name: /組織を作成/i }).click();

    // 成功時は /orgs にリダイレクトされる
    await expect(page).toHaveURL(new RegExp(`${DOMAINS.OPS}/orgs`));

    // クリーンアップ: 作成した組織とユーザーを削除
    const supabaseAdmin = getSupabaseAdmin();

    // organizationsテーブルから削除
    const { data: org } = await supabaseAdmin
      .from('organizations')
      .select('id')
      .eq('slug', orgSlug)
      .single();

    if (org) {
      // profilesを削除
      await supabaseAdmin
        .from('profiles')
        .delete()
        .eq('org_id', org.id);

      // organizationsを削除
      await supabaseAdmin
        .from('organizations')
        .delete()
        .eq('id', org.id);
    }

    // auth.usersから削除
    const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
    const createdUser = users?.find((u) => u.email === ownerEmail);
    if (createdUser) {
      await supabaseAdmin.auth.admin.deleteUser(createdUser.id);
    }
  });

  test('ops管理者 → パスワード不一致でエラー表示', async ({ page }) => {
    await uiLogin(page, OPS_USER.email, PASSWORD);
    await page.goto(`${DOMAINS.OPS}/orgs/new`);

    const timestamp = Date.now();
    const orgSlug = `test-org-${timestamp}`;
    const ownerEmail = `owner-${timestamp}@example.com`;

    // フォームに入力（パスワードを異なる値に）
    await page.locator('input#org-name').fill('テスト組織');
    await page.locator('input#org-slug').fill(orgSlug);
    await page.locator('input#owner-name').fill('テストオーナー');
    await page.locator('input#owner-email').fill(ownerEmail);
    await page.locator('input#owner-password').fill(PASSWORD);
    await page.locator('input#owner-password-confirm').fill('different-password');

    // 作成ボタンをクリック
    await page.getByRole('button', { name: /組織を作成/i }).click();

    // エラーメッセージが表示される
    await expect(page.getByText(/パスワードが一致しません/i)).toBeVisible();
  });

  test('ops管理者 → 予約語スラッグでエラー表示', async ({ page }) => {
    await uiLogin(page, OPS_USER.email, PASSWORD);
    await page.goto(`${DOMAINS.OPS}/orgs/new`);

    const timestamp = Date.now();
    const ownerEmail = `owner-${timestamp}@example.com`;

    // フォームに入力（予約語スラッグを使用）
    await page.locator('input#org-name').fill('テスト組織');
    await page.locator('input#org-slug').fill('admin'); // 予約語
    await page.locator('input#owner-name').fill('テストオーナー');
    await page.locator('input#owner-email').fill(ownerEmail);
    await page.locator('input#owner-password').fill(PASSWORD);
    await page.locator('input#owner-password-confirm').fill(PASSWORD);

    // 作成ボタンをクリック
    await page.getByRole('button', { name: /組織を作成/i }).click();

    // エラーメッセージが表示される
    await expect(page.getByText(/予約されているため使用できません/i)).toBeVisible();
  });

  test('ops管理者 → 重複スラッグでエラー表示', async ({ page }) => {
    await uiLogin(page, OPS_USER.email, PASSWORD);
    await page.goto(`${DOMAINS.OPS}/orgs/new`);

    const timestamp = Date.now();
    const ownerEmail = `owner-${timestamp}@example.com`;

    // フォームに入力（既存のスラッグ 'acme' を使用）
    await page.locator('input#org-name').fill('テスト組織');
    await page.locator('input#org-slug').fill('acme'); // 既存のslug
    await page.locator('input#owner-name').fill('テストオーナー');
    await page.locator('input#owner-email').fill(ownerEmail);
    await page.locator('input#owner-password').fill(PASSWORD);
    await page.locator('input#owner-password-confirm').fill(PASSWORD);

    // 作成ボタンをクリック
    await page.getByRole('button', { name: /組織を作成/i }).click();

    // エラーメッセージが表示される
    await expect(page.getByText(/既に使用されています/i)).toBeVisible();
  });
});
