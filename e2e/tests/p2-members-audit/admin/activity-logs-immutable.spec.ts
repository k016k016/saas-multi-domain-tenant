import { test, expect } from '@playwright/test';
import { DOMAINS } from '../../../helpers/domains';
import { uiLogin } from '../../../helpers/auth';
import { getSupabaseAdmin } from '@repo/db';

// 並列テスト用: このファイル専用のユーザー
const ADMIN = { email: 'admin4@example.com' };
const OWNER = { email: 'owner4@example.com' };
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

test.describe('監査ログフィールド検証', () => {
  test('新フィールド（request_id, session_id, ip_address, user_agent, severity）が正しく記録される', async ({ page }) => {
    await uiLogin(page, ADMIN.email, PASSWORD);

    const supabase = getSupabaseAdmin();

    // 既存のログから組織IDとユーザーIDを取得
    const { data: existingLog } = await supabase
      .from('activity_logs')
      .select('org_id, user_id')
      .limit(1)
      .single();

    expect(existingLog).not.toBeNull();

    // 新フィールドを含むINSERT
    const testRequestId = crypto.randomUUID();
    const testSessionId = crypto.randomUUID();
    const { data: inserted, error: insertError } = await supabase
      .from('activity_logs')
      .insert({
        org_id: existingLog!.org_id,
        user_id: existingLog!.user_id,
        action: 'test.new_fields_check',
        payload: { test: true },
        request_id: testRequestId,
        session_id: testSessionId,
        ip_address: '203.0.113.42',
        user_agent: 'Mozilla/5.0 (Test) E2E/1.0',
        severity: 'warning',
      })
      .select()
      .single();

    expect(insertError).toBeNull();
    expect(inserted).not.toBeNull();

    // 新フィールドの値を確認
    expect(inserted?.request_id).toBe(testRequestId);
    expect(inserted?.session_id).toBe(testSessionId);
    expect(inserted?.ip_address).toBe('203.0.113.42');
    expect(inserted?.user_agent).toBe('Mozilla/5.0 (Test) E2E/1.0');
    expect(inserted?.severity).toBe('warning');
  });

  test('request_id/session_idがUUID形式で記録される', async ({ page }) => {
    await uiLogin(page, ADMIN.email, PASSWORD);

    const supabase = getSupabaseAdmin();

    // 既存のログから組織IDとユーザーIDを取得
    const { data: existingLog } = await supabase
      .from('activity_logs')
      .select('org_id, user_id')
      .limit(1)
      .single();

    const { data: inserted, error } = await supabase
      .from('activity_logs')
      .insert({
        org_id: existingLog!.org_id,
        user_id: existingLog!.user_id,
        action: 'test.uuid_format_check',
        payload: {},
        request_id: crypto.randomUUID(),
        session_id: crypto.randomUUID(),
      })
      .select()
      .single();

    expect(error).toBeNull();

    // UUID v4形式確認（8-4-4-4-12の形式）
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    expect(inserted?.request_id).toMatch(uuidPattern);
    expect(inserted?.session_id).toMatch(uuidPattern);
  });

  test('severity値（info/warning/critical）で正しくINSERT/SELECT可能', async ({ page }) => {
    await uiLogin(page, ADMIN.email, PASSWORD);

    const supabase = getSupabaseAdmin();

    const { data: existingLog } = await supabase
      .from('activity_logs')
      .select('org_id, user_id')
      .limit(1)
      .single();

    // 各severity値でテスト
    for (const severityValue of ['info', 'warning', 'critical'] as const) {
      const { data: inserted, error } = await supabase
        .from('activity_logs')
        .insert({
          org_id: existingLog!.org_id,
          user_id: existingLog!.user_id,
          action: `test.severity_${severityValue}`,
          payload: {},
          severity: severityValue,
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(inserted?.severity).toBe(severityValue);
    }
  });

  test('severityのデフォルト値が"info"で記録される', async ({ page }) => {
    await uiLogin(page, ADMIN.email, PASSWORD);

    const supabase = getSupabaseAdmin();

    const { data: existingLog } = await supabase
      .from('activity_logs')
      .select('org_id, user_id')
      .limit(1)
      .single();

    // severity指定なしでINSERT
    const { data: inserted, error } = await supabase
      .from('activity_logs')
      .insert({
        org_id: existingLog!.org_id,
        user_id: existingLog!.user_id,
        action: 'test.severity_default',
        payload: {},
      })
      .select()
      .single();

    expect(error).toBeNull();
    // デフォルト値'info'が設定されることを確認
    expect(inserted?.severity).toBe('info');
  });

  test('request_id/session_id/ip_address/user_agentはNULLで記録可能', async ({ page }) => {
    await uiLogin(page, ADMIN.email, PASSWORD);

    const supabase = getSupabaseAdmin();

    const { data: existingLog } = await supabase
      .from('activity_logs')
      .select('org_id, user_id')
      .limit(1)
      .single();

    // オプションフィールドを指定せずINSERT
    const { data: inserted, error } = await supabase
      .from('activity_logs')
      .insert({
        org_id: existingLog!.org_id,
        user_id: existingLog!.user_id,
        action: 'test.optional_fields_null',
        payload: {},
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(inserted).not.toBeNull();

    // オプションフィールドはNULL
    expect(inserted?.request_id).toBeNull();
    expect(inserted?.session_id).toBeNull();
    expect(inserted?.ip_address).toBeNull();
    expect(inserted?.user_agent).toBeNull();
  });
});
