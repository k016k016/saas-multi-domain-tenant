import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
config({ path: '.env.test' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function main() {
  // ページネーション付きで全ユーザーを取得
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) { console.error(error); return; }

  console.log('Total users:', data.users.length);

  // owner-数字@example.com パターンのユーザーを抽出
  const garbageUsers = data.users.filter(u => u.email && /^owner-\d+@example\.com$/.test(u.email));
  console.log('Garbage users found:', garbageUsers.length);

  for (const user of garbageUsers) {
    console.log('Deleting:', user.email);

    // profiles から削除
    await supabase.from('profiles').delete().eq('user_id', user.id);

    // user_org_context から削除
    await supabase.from('user_org_context').delete().eq('user_id', user.id);

    // auth.users から削除
    const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
    if (deleteError) {
      console.log('  Error:', deleteError.message);
    } else {
      console.log('  Deleted successfully');
    }
  }

  console.log('Cleanup completed');
}
main();
