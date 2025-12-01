import { test, expect, type TestInfo } from '@playwright/test';
import { DOMAINS } from '../../helpers/domains';
import { uiLogin } from '../../helpers/auth';
import { getSupabaseAdmin } from '@repo/db';
import { deleteTestOrganization } from '../../helpers/db';

// OPS管理者ユーザー（seed-test-userで作成）
const OPS_USER = { email: 'ops1@example.com' };
const PASSWORD = process.env.E2E_TEST_PASSWORD!;

type CleanupRecord = {
  orgIds: Set<string>;
  ownerEmails: Set<string>;
};

const cleanupRegistry = new Map<string, CleanupRecord>();

function getCleanupBucket(testInfo: TestInfo): CleanupRecord {
  let bucket = cleanupRegistry.get(testInfo.testId);
  if (!bucket) {
    bucket = { orgIds: new Set(), ownerEmails: new Set() };
    cleanupRegistry.set(testInfo.testId, bucket);
  }
  return bucket;
}

function registerOrgCleanup(testInfo: TestInfo, orgId: string) {
  getCleanupBucket(testInfo).orgIds.add(orgId);
}

function registerOwnerCleanup(testInfo: TestInfo, email: string) {
  getCleanupBucket(testInfo).ownerEmails.add(email);
}

async function registerCreatedResources(testInfo: TestInfo, orgSlug: string, ownerEmail: string) {
  const supabaseAdmin = getSupabaseAdmin();
  const { data: org } = await supabaseAdmin
    .from('organizations')
    .select('id')
    .eq('slug', orgSlug)
    .single();

  if (org?.id) {
    registerOrgCleanup(testInfo, org.id);
  }

  registerOwnerCleanup(testInfo, ownerEmail);
}

test.describe('ops/orgs/new - 組織作成', () => {
  test.afterEach(async ({}, testInfo) => {
    const bucket = cleanupRegistry.get(testInfo.testId);
    if (!bucket) {
      return;
    }

    cleanupRegistry.delete(testInfo.testId);

    const supabaseAdmin = getSupabaseAdmin();

    for (const orgId of bucket.orgIds) {
      try {
        await deleteTestOrganization(orgId);
      } catch (error) {
        console.warn('[ops-create-org] Failed to delete org during cleanup', { orgId, error });
      }
    }

    if (bucket.ownerEmails.size > 0) {
      const { data: { users } } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      for (const email of bucket.ownerEmails) {
        const user = users?.find((u) => u.email === email);
        if (!user) continue;

        await supabaseAdmin.from('profiles').delete().eq('user_id', user.id);
        await supabaseAdmin.from('user_org_context').delete().eq('user_id', user.id);
        await supabaseAdmin.auth.admin.deleteUser(user.id);
      }
    }
  });

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

  test('ops管理者 → 組織作成が成功する', async ({ page }, testInfo) => {
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

    await registerCreatedResources(testInfo, orgSlug, ownerEmail);
  });

  test('ops管理者 → 新規ownerが app/admin にログインできる', async ({ page }, testInfo) => {
    await uiLogin(page, OPS_USER.email, PASSWORD);
    await page.goto(`${DOMAINS.OPS}/orgs/new`);

    const timestamp = Date.now();
    const orgName = `ログイン検証組織-${timestamp}`;
    const orgSlug = `login-verify-${timestamp}`;
    const ownerEmail = `owner-${timestamp}@example.com`;

    await page.locator('input#org-name').fill(orgName);
    await page.locator('input#org-slug').fill(orgSlug);
    await page.locator('input#owner-name').fill('ログイン検証オーナー');
    await page.locator('input#owner-email').fill(ownerEmail);
    await page.locator('input#owner-password').fill(PASSWORD);
    await page.locator('input#owner-password-confirm').fill(PASSWORD);
    await page.getByRole('button', { name: /組織を作成/i }).click();
    await expect(page).toHaveURL(new RegExp(`${DOMAINS.OPS}/orgs`));

    await registerCreatedResources(testInfo, orgSlug, ownerEmail);

    // 新オーナーとしてログインし、app/admin両方のセッションを確認
    await page.context().clearCookies();
    await uiLogin(page, ownerEmail, PASSWORD);
    await expect(page).toHaveURL(new RegExp(`${DOMAINS.APP}`));
    await expect(page.locator('body')).toContainText(orgName);

    await page.goto(`${DOMAINS.ADMIN}/members`);
    await expect(page.getByRole('heading', { name: /メンバー管理/i })).toBeVisible();
    await expect(page.getByText(ownerEmail)).toBeVisible();
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
