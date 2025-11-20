/**
 * テストユーザーのロールを修正するスクリプト
 *
 * 修正内容:
 * - owner1@example.com を Test Organization の owner に設定
 * - owner2@example.com を Test Organization Beta の owner に設定
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { getSupabaseAdmin } from '@repo/db';

async function fixTestUsersRoles() {
  const supabase = getSupabaseAdmin();

  console.log('📝 テストユーザーのロールを修正します...\n');

  // 1. 組織IDを取得
  const { data: orgs, error: orgsError } = await supabase
    .from('organizations')
    .select('id, name, slug')
    .in('slug', ['acme', 'beta']);

  if (orgsError || !orgs) {
    console.error('❌ 組織の取得に失敗:', orgsError);
    return;
  }

  const acmeOrg = orgs.find(o => o.slug === 'acme');
  const betaOrg = orgs.find(o => o.slug === 'beta');

  if (!acmeOrg || !betaOrg) {
    console.error('❌ acme または beta 組織が見つかりません');
    return;
  }

  console.log(`✓ 組織を取得しました:`);
  console.log(`  - ${acmeOrg.name} (${acmeOrg.slug}): ${acmeOrg.id}`);
  console.log(`  - ${betaOrg.name} (${betaOrg.slug}): ${betaOrg.id}\n`);

  // 2. ユーザーIDを取得
  const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();

  if (usersError || !users) {
    console.error('❌ ユーザーの取得に失敗:', usersError);
    return;
  }

  const owner1 = users.find(u => u.email === 'owner1@example.com');
  const owner2 = users.find(u => u.email === 'owner2@example.com');

  if (!owner1 || !owner2) {
    console.error('❌ owner1 または owner2 が見つかりません');
    return;
  }

  console.log(`✓ ユーザーを取得しました:`);
  console.log(`  - owner1@example.com: ${owner1.id}`);
  console.log(`  - owner2@example.com: ${owner2.id}\n`);

  // 3. owner1 を Test Organization (acme) の owner に設定
  const { error: owner1Error } = await supabase
    .from('profiles')
    .upsert({
      user_id: owner1.id,
      org_id: acmeOrg.id,
      role: 'owner',
    }, {
      onConflict: 'user_id,org_id'
    });

  if (owner1Error) {
    console.error('❌ owner1 のロール更新に失敗:', owner1Error);
  } else {
    console.log(`✓ owner1@example.com を ${acmeOrg.name} の owner に設定しました`);
  }

  // 4. owner2 を Test Organization Beta (beta) の owner に設定
  const { error: owner2Error } = await supabase
    .from('profiles')
    .upsert({
      user_id: owner2.id,
      org_id: betaOrg.id,
      role: 'owner',
    }, {
      onConflict: 'user_id,org_id'
    });

  if (owner2Error) {
    console.error('❌ owner2 のロール更新に失敗:', owner2Error);
  } else {
    console.log(`✓ owner2@example.com を ${betaOrg.name} の owner に設定しました`);
  }

  // 5. 確認
  console.log('\n📋 現在の設定を確認:');

  const { data: owner1Profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', owner1.id)
    .eq('org_id', acmeOrg.id)
    .single();

  const { data: owner2Profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', owner2.id)
    .eq('org_id', betaOrg.id)
    .single();

  console.log(`  - owner1@example.com @ ${acmeOrg.name}: ${owner1Profile?.role || 'なし'}`);
  console.log(`  - owner2@example.com @ ${betaOrg.name}: ${owner2Profile?.role || 'なし'}`);

  console.log('\n✅ 完了しました！');
}

fixTestUsersRoles().catch(console.error);