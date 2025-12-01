import { config } from 'dotenv';
config({ path: '.env.test' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  let page = 1;
  let total = 0;
  let owner1Found = false;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) {
      console.error('Error:', error.message);
      break;
    }

    total += data.users.length;
    console.log(`Page ${page}: ${data.users.length} users`);

    const owner1 = data.users.find(u => u.email === 'owner1@example.com');
    if (owner1) {
      owner1Found = true;
      console.log('owner1 found on page', page);
    }

    if (data.users.length < 1000) break;
    page++;
  }

  console.log('Total users:', total);
  console.log('owner1 found:', owner1Found);
}

main().catch(console.error);
