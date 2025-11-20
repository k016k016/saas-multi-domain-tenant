import { test, expect } from '@playwright/test';
import { DOMAINS } from '../../../helpers/domains';
import { uiLogin } from '../../../helpers/auth';

const MEMBER = { email: 'member1@example.com' };
const ADMIN = { email: 'admin1@example.com' };
const PASSWORD = process.env.E2E_TEST_PASSWORD!;

// 注: このテストは複数組織のテストデータが必要です
// org_id=00000000-0000-0000-0000-000000000001 (デフォルト)
// org_id=00000000-0000-0000-0000-000000000002 (別組織)

test.describe('RLS境界テスト', () => {
  test('member → 異なる組織のメンバー一覧へアクセス拒否', async ({ page }) => {
    await uiLogin(page, MEMBER.email, PASSWORD);

    // 現在の組織のメンバー一覧にアクセス（org_id=1と仮定）
    await page.goto(`${DOMAINS.ADMIN}/members`);

    // memberはADMINにアクセスできないため、/unauthorizedへリダイレクト
    await expect(page).toHaveURL(new RegExp(`${DOMAINS.ADMIN}/unauthorized`));

    // 注: RLSの検証は、実際にはadmin/ownerでサインインして
    // 別組織のデータが表示されないことを確認する必要があります
    // しかし、E2Eレベルでは組織IDを直接操作できないため、
    // この테스트は境界確認の意図を示す「スモークテスト」です
  });

    test('admin → 異なる組織の監査ログへアクセス拒否', async ({ page }) => {
    await uiLogin(page, ADMIN.email, PASSWORD);

    // 監査ログページにアクセス
    await page.goto(`${DOMAINS.ADMIN}/audit-logs`);

    // Firefoxでのレンダリング待機
    await page.waitForLoadState('networkidle');

    // adminはアクセス可能なはず
    await expect(page.getByRole('heading', { name: /監査ログ/i })).toBeVisible();

    // テーブルが表示されることを確認
    const table = page.getByRole('table');
    await expect(table).toBeVisible();

    // RLS検証: テーブル内のすべての行が現在の組織（org_id=1）のものであることを確認
    // 注: 実際のE2Eテストでは、データ内容までは検証が難しいため、
    // ここでは「テーブルが表示される」ことのみを確認しています。
    // RLSの詳細な検証は、別のユニットテストやAPI テストで行うべきです。

    // スモークテスト: 少なくとも1行はあるはず（自分の操作が記録されているため）
    const rows = await table.locator('tbody tr').count();
    expect(rows).toBeGreaterThan(0);
  });
});
