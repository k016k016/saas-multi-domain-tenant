import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const DEFAULT_ENV_PATH = process.env.E2E_ENV_PATH ?? '.env.test';
config({ path: DEFAULT_ENV_PATH, override: false });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for cleanup.');
}

const TEST_EMAIL_PREFIXES = (process.env.E2E_TEST_EMAIL_PREFIXES ?? 'ops-test-,test-,delete-test-')
  .split(',')
  .map(prefix => prefix.trim().toLowerCase())
  .filter(Boolean);

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export async function cleanupE2EUsers({ quiet = false }: { quiet?: boolean } = {}) {
  const shouldDelete = (email?: string | null) => {
    if (!email) return false;
    const lower = email.toLowerCase();
    return TEST_EMAIL_PREFIXES.some(prefix => lower.startsWith(prefix));
  };

  let page = 1;
  const perPage = 1000;
  let totalDeleted = 0;

  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw new Error(`Failed to list users: ${error.message}`);
    }

    const users = data?.users ?? [];
    if (users.length === 0) {
      break;
    }

    for (const user of users) {
      if (!shouldDelete(user.email)) {
        continue;
      }

      await supabase.from('profiles').delete().eq('user_id', user.id);
      await supabase.from('user_org_context').delete().eq('user_id', user.id);

      const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
      if (deleteError) {
        throw new Error(`Failed to delete user ${user.email}: ${deleteError.message}`);
      }

      totalDeleted += 1;
      if (!quiet) {
        console.log(`🧹 Deleted E2E user ${user.email}`);
      }
    }

    if (users.length < perPage) {
      break;
    }

    page += 1;
  }

  if (!quiet) {
    console.log(`✨ Cleanup complete. Removed ${totalDeleted} user(s).`);
  }
}
