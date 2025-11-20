/**
 * profiles テーブルの role CHECK 制約を修正
 *
 * ops ロールを許可するように更新します。
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.test' });

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error('Missing environment variables');
  }

  console.log('🔧 Fixing profiles role constraint...');

  const supabase = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    db: {
      schema: 'public',
    },
  });

  // 既存の制約を削除して新しい制約を追加
  const { error: dropError } = await supabase.rpc('exec', {
    query: `
      ALTER TABLE profiles
      DROP CONSTRAINT IF EXISTS profiles_role_check;
    `,
  });

  if (dropError) {
    console.warn('⚠️ Failed to drop constraint (may not exist):', dropError.message);
  } else {
    console.log('✅ Dropped existing constraint');
  }

  const { error: addError } = await supabase.rpc('exec', {
    query: `
      ALTER TABLE profiles
      ADD CONSTRAINT profiles_role_check CHECK (role IN ('member', 'admin', 'owner', 'ops'));
    `,
  });

  if (addError) {
    console.error('❌ Failed to add new constraint:', addError.message);
    throw addError;
  }

  console.log('✅ Added new constraint with ops role');
  console.log('🎉 Constraint fixed successfully');
}

main().catch((error) => {
  console.error('❌ Failed:', error.message);
  process.exit(1);
});
