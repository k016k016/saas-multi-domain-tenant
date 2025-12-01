import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
config({ path: '.env.test' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function main() {
  // ページネーションなしで呼び出し（テストと同じ方法）
  const { data, error } = await supabase.auth.admin.listUsers();
  if (error) { console.error(error); return; }

  console.log('Total users returned:', data.users.length);
  console.log('All emails:', data.users.map(u => u.email).sort().join(', '));

  const testUsers = ['owner1@example.com', 'admin1@example.com', 'member1@example.com'];
  for (const email of testUsers) {
    const user = data.users.find(u => u.email === email);
    if (user) {
      console.log(email + ': FOUND (id: ' + user.id + ')');
    } else {
      console.log(email + ': NOT FOUND');
    }
  }
}
main();
