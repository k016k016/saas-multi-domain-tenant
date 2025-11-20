import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { getSupabaseAdmin } from '@repo/db';

async function checkOrgSlugs() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('organizations')
    .select('id, name, slug')
    .order('created_at');

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Current organizations:');
    data?.forEach(org => {
      console.log(`  ${org.id}: ${org.name} (slug: ${org.slug || 'NULL'})`);
    });
  }
}

checkOrgSlugs().catch(console.error);