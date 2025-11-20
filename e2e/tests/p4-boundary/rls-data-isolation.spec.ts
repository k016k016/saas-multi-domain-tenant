/**
 * Phase 4: RLS（Row Level Security）データ分離テスト
 *
 * テスト内容:
 * - 異なる組織のデータが混在しない
 * - APIレベルでのデータ分離
 * - 組織切り替え時のデータ切り替わり
 * - 権限がないデータへのアクセス拒否
 *
 * 使用ユーザー:
 * - member1@example.com (org1: member, org2: admin)
 * - admin1@example.com (org1: admin, org2: member)
 * - owner2@example.com (org2: owner)
 */

import { test, expect } from '@playwright/test';
import { uiLogin } from '../../helpers/auth';
import { resetUserToOrg1, setUserActiveOrg, ORG_IDS } from '../../helpers/db';

const PASSWORD = process.env.E2E_TEST_PASSWORD!;

test.describe('RLS Data Isolation', () => {
  test.beforeEach(async () => {
    // 各ユーザーのアクティブ組織をリセット
    await resetUserToOrg1('member1@example.com');
    await resetUserToOrg1('admin1@example.com');
  });

  test.describe('組織間のデータ分離', () => {
    test('org1のメンバー一覧にorg2のメンバーが表示されない', async ({ page }) => {
      // admin1でログイン（org1でadmin権限）
      await uiLogin(page, 'admin1@example.com', PASSWORD);

      // admin domainのメンバー管理ページへ
      await page.goto('http://admin.local.test:3003/members');

      // org1のメンバーだけが表示される
      await expect(page.getByRole('heading', { name: 'メンバー管理' })).toBeVisible();

      // org1のメンバーが表示されている
      await expect(page.getByText('member1@example.com')).toBeVisible();
      await expect(page.getByText('admin1@example.com')).toBeVisible();
      await expect(page.getByText('owner1@example.com')).toBeVisible();

      // org2のメンバーは表示されない
      await expect(page.getByText('member2@example.com')).not.toBeVisible();
      await expect(page.getByText('admin2@example.com')).not.toBeVisible();
      await expect(page.getByText('owner2@example.com')).not.toBeVisible();
    });

    test('URLパラメータで組織を変えてもRLSで適切なデータのみ表示', async ({ page }) => {
      // member1でログイン（org1: member, org2: admin）
      await uiLogin(page, 'member1@example.com', PASSWORD);

      // org1のメンバー管理（memberなので403）
      await page.goto('http://admin.local.test:3003/members?org=acme');
      await expect(page).toHaveURL(/unauthorized/);

      // org2のメンバー管理（adminなのでアクセス可能）
      await page.goto('http://admin.local.test:3003/members?org=beta');
      await expect(page.getByRole('heading', { name: 'メンバー管理' })).toBeVisible();

      // org2のメンバーのみ表示
      await expect(page.getByText('Test Organization Beta').first()).toBeVisible();
      await expect(page.getByText('member1@example.com')).toBeVisible(); // member1はorg2にもadminで所属
      await expect(page.getByText('admin1@example.com')).toBeVisible(); // admin1はorg2にmemberで所属
      await expect(page.getByText('member2@example.com')).toBeVisible();
      await expect(page.getByText('admin2@example.com')).toBeVisible();
      await expect(page.getByText('owner2@example.com')).toBeVisible();

      // owner1はorg1専用なので表示されない
      await expect(page.getByText('owner1@example.com')).not.toBeVisible();
    });

    test('動的ルートで組織を指定してもRLSで適切なデータのみ表示', async ({ page }) => {
      // member1でログイン
      await uiLogin(page, 'member1@example.com', PASSWORD);

      // /org/beta/members へアクセス（org2でadmin権限）
      await page.goto('http://admin.local.test:3003/org/beta/members');
      await expect(page.getByRole('heading', { name: 'メンバー管理' })).toBeVisible();

      // org2のメンバーのみ表示
      await expect(page.getByText('Test Organization Beta').first()).toBeVisible();
      await expect(page.getByText('member1@example.com')).toBeVisible(); // member1はorg2にもadminで所属
      await expect(page.getByText('member2@example.com')).toBeVisible();

      // owner1はorg1専用なので表示されない
      await expect(page.getByText('owner1@example.com')).not.toBeVisible();
    });
  });

  test.describe('監査ログのデータ分離', () => {
    test('org1の監査ログにorg2のログが表示されない', async ({ page }) => {
      // admin1でログイン（org1でadmin権限）
      await uiLogin(page, 'admin1@example.com', PASSWORD);

      // 監査ログページへ
      await page.goto('http://admin.local.test:3003/audit-logs');
      await expect(page.getByRole('heading', { name: '監査ログ' })).toBeVisible();

      // org1の組織名が表示される
      await expect(page.getByText('Test Organization').first()).toBeVisible();

      // org2の組織名は表示されない
      await expect(page.getByText('Test Organization Beta').first()).not.toBeVisible();

      // テーブルまたはリストが存在する場合
      const logEntries = page.locator('[data-testid="audit-log-entry"]');
      const count = await logEntries.count();

      if (count > 0) {
        // 各ログエントリーにorg2関連の情報が含まれていないことを確認
        for (let i = 0; i < count; i++) {
          const entry = logEntries.nth(i);
          const text = await entry.textContent();
          expect(text).not.toContain('beta');
          expect(text).not.toContain('org2');
          expect(text).not.toContain('Test Organization Beta');
        }
      }
    });

    test('URLで別組織を指定して監査ログを見ても適切なデータのみ表示', async ({ page }) => {
      // member1でログイン（org2でadmin権限）
      await uiLogin(page, 'member1@example.com', PASSWORD);

      // org2の監査ログページへ
      await page.goto('http://admin.local.test:3003/audit-logs?org=beta');
      await expect(page.getByRole('heading', { name: '監査ログ' })).toBeVisible();

      // org2の組織名が表示される
      await expect(page.getByText('Test Organization Beta').first()).toBeVisible();
    });
  });

  test.describe('組織設定のデータ分離', () => {
    test('ownerは自分の組織の設定のみ閲覧可能', async ({ page }) => {
      // owner1でログイン（org1のowner）
      await uiLogin(page, 'owner1@example.com', PASSWORD);

      // org1の組織設定ページ
      await page.goto('http://admin.local.test:3003/org-settings');
      await expect(page.getByRole('heading', { name: '組織設定' })).toBeVisible();

      // org1の情報が表示される
      await expect(page.getByText('Test Organization').first()).toBeVisible();

      // 他の組織の設定にアクセスしようとしても403
      await page.goto('http://admin.local.test:3003/org-settings?org=beta');
      await expect(page).toHaveURL(/unauthorized/);
    });

    test('owner権限があっても別組織の設定は見られない', async ({ page }) => {
      // owner2でログイン（org2のowner）
      await setUserActiveOrg('owner2@example.com', ORG_IDS.SECONDARY);
      await uiLogin(page, 'owner2@example.com', PASSWORD);

      // org2の組織設定ページ
      await page.goto('http://admin.local.test:3003/org-settings');
      await expect(page.getByRole('heading', { name: '組織設定' })).toBeVisible();

      // org2の情報が表示される
      await expect(page.getByText('Test Organization Beta').first()).toBeVisible();

      // org1の組織設定にアクセスしようとしても403（owner権限なし）
      await page.goto('http://admin.local.test:3003/org-settings?org=acme');
      await expect(page).toHaveURL(/unauthorized/);
    });

    test('動的ルートで別組織の設定にアクセスしても適切に制限', async ({ page }) => {
      // owner1でログイン
      await uiLogin(page, 'owner1@example.com', PASSWORD);

      // org1の組織設定（動的ルート）
      await page.goto('http://admin.local.test:3003/org/acme/org-settings');
      await expect(page.getByRole('heading', { name: '組織設定' })).toBeVisible();
      await expect(page.getByText('Test Organization').first()).toBeVisible();

      // org2の組織設定（動的ルート）にアクセスしても403/404
      const forbiddenResponse = await page.goto('http://admin.local.test:3003/org/beta/org-settings');
      expect([403, 404]).toContain(forbiddenResponse?.status());
    });
  });

  test.describe('APIレベルでのデータ分離確認', () => {
    test('直接APIを叩いても組織外のデータは取得できない', async ({ page, context }) => {
      // admin1でログイン（org1のadmin）
      await uiLogin(page, 'admin1@example.com', PASSWORD);

      // Cookieを取得
      const cookies = await context.cookies();
      const sessionCookie = cookies.find(c => c.name.includes('auth-token') || c.name.includes('session'));

      if (sessionCookie) {
        // org2のデータを取得しようとする（期待: エラーまたは空）
        const response = await page.request.get('http://admin.local.test:3003/api/members?org=beta', {
          headers: {
            'Cookie': `${sessionCookie.name}=${sessionCookie.value}`
          }
        });

        // 403または404、あるいは空配列を返すことを確認
        const status = response.status();
        expect([403, 404, 200]).toContain(status);

        if (status === 200) {
          const data = await response.json();
          // データが返ってきた場合、org2のデータが含まれていないことを確認
          if (Array.isArray(data)) {
            data.forEach(member => {
              expect(member.email).not.toContain('2@example.com');
            });
          }
        }
      }
    });
  });

  test.describe('組織切り替え時のデータ切り替わり', () => {
    test('組織を切り替えると表示データが完全に切り替わる', async ({ page }) => {
      // member1でログイン（org1: member, org2: admin）
      await uiLogin(page, 'member1@example.com', PASSWORD);

      // デフォルトはorg1
      await expect(page.getByText('Test Organization').first()).toBeVisible();
      await expect(page.url()).toContain('app.local.test');

      // org2に切り替え（DBヘルパーで強制）
      await setUserActiveOrg('member1@example.com', ORG_IDS.SECONDARY);
      await page.reload();

      // org2のコンテキストでadmin domainへ
      await page.goto('http://admin.local.test:3003/members');
      await expect(page.getByRole('heading', { name: 'メンバー管理' })).toBeVisible();

      // org2のメンバーのみ表示
      await expect(page.getByText('Test Organization Beta').first()).toBeVisible();
      await expect(page.getByText('member1@example.com')).toBeVisible(); // member1はorg2にもadminで所属
      await expect(page.getByText('member2@example.com')).toBeVisible();

      // owner1はorg1専用なので表示されない
      await expect(page.getByText('owner1@example.com')).not.toBeVisible();

      // org1に再度切り替え
      await setUserActiveOrg('member1@example.com', ORG_IDS.PRIMARY);

      // org1のコンテキストではmember権限なので403/unauthorized
      await page.goto('http://admin.local.test:3003/members');
      await expect(page).toHaveURL(/unauthorized/);
    });
  });
});
