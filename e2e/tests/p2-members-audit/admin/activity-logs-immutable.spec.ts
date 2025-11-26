import { test, expect } from '@playwright/test';
import { DOMAINS } from '../../../helpers/domains';
import { uiLogin } from '../../../helpers/auth';
import { getSupabaseAdmin } from '@repo/db';

const ADMIN = { email: 'admin1@example.com' };
const OWNER = { email: 'owner1@example.com' };
const PASSWORD = process.env.E2E_TEST_PASSWORD!;

test.describe('監査ログイミュータブル性', () => {
  test('admin → 監査ログの直接UPDATE試行でエラー', async ({ page }) => {
    await uiLogin(page, ADMIN.email, PASSWORD);

    // Supabaseクライアントを使って直接UPDATE試行
    const supabase = getSupabaseAdmin();

    // まず任意のログを取得
    const { data: logs } = await supabase
      .from('activity_logs')
      .select('id')
      .limit(1)
      .single();

    if (!logs) {
      throw new Error('テスト用のログが存在しません');
    }

    // UPDATEを試行（エラーになることを期待）
    const { error } = await supabase
      .from('activity_logs')
      .update({ action: 'test.modified' })
      .eq('id', logs.id);

    // エラーが発生することを確認
    expect(error).not.toBeNull();
    // RLSまたはトリガーによってUPDATEがブロックされることを確認
    expect(error?.message).toMatch(/監査ログは変更できません|row-level security|immutable/i);
  });

  test('owner → 監査ログの直接DELETE試行でエラー', async ({ page }) => {
    await uiLogin(page, OWNER.email, PASSWORD);

    // Supabaseクライアントを使って直接DELETE試行
    const supabase = getSupabaseAdmin();

    // まず任意のログを取得
    const { data: logs } = await supabase
      .from('activity_logs')
      .select('id')
      .limit(1)
      .single();

    if (!logs) {
      throw new Error('テスト用のログが存在しません');
    }

    // DELETEを試行（エラーになることを期待）
    const { error } = await supabase
      .from('activity_logs')
      .delete()
      .eq('id', logs.id);

    // エラーが発生することを確認
    expect(error).not.toBeNull();
    // RLSまたはトリガーによってDELETEがブロックされることを確認
    expect(error?.message).toMatch(/監査ログは削除できません|row-level security|immutable/i);
  });

  test('admin → INSERT/SELECT操作は正常動作', async ({ page }) => {
    await uiLogin(page, ADMIN.email, PASSWORD);

    const supabase = getSupabaseAdmin();

    // 既存のログから組織IDとユーザーIDを取得
    const { data: existingLog } = await supabase
      .from('activity_logs')
      .select('org_id, user_id')
      .limit(1)
      .single();

    expect(existingLog).not.toBeNull();

    // INSERTは正常動作（監査ログヘルパーと同じ形式で）
    const { data: inserted, error: insertError } = await supabase
      .from('activity_logs')
      .insert({
        org_id: existingLog!.org_id,
        user_id: existingLog!.user_id,
        action: 'test.immutable_check',
        payload: { test: true },
      })
      .select()
      .single();

    expect(insertError).toBeNull();
    expect(inserted).not.toBeNull();

    // SELECTは正常動作
    const { data: selected, error: selectError } = await supabase
      .from('activity_logs')
      .select('*')
      .eq('id', inserted!.id)
      .single();

    expect(selectError).toBeNull();
    expect(selected).not.toBeNull();
    expect(selected?.action).toBe('test.immutable_check');
  });
});
