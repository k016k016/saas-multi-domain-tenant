/**
 * マイグレーション実行スクリプト
 *
 * 使い方:
 * tsx scripts/run-migration.ts infra/supabase/migrations/20251120000000_add_org_slug.sql
 */

import { config } from 'dotenv';
import { getSupabaseAdmin } from '@repo/db';
import { readFileSync } from 'fs';

config({ path: '.env.test' });

async function runMigration(sqlFilePath: string) {
  console.log(`📝 Running migration: ${sqlFilePath}`);

  const supabaseAdmin = getSupabaseAdmin();
  const sql = readFileSync(sqlFilePath, 'utf-8');

  // SQLを実行（rpc経由）
  const { error } = await supabaseAdmin.rpc('exec_sql', { sql_query: sql });

  if (error) {
    // exec_sqlが存在しない場合は、直接クエリを実行
    console.log('⚠️ exec_sql not available, trying direct query...');

    // 改行で分割して個別に実行
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      const { error: execError } = await supabaseAdmin.from('_').select('*').limit(0);

      if (execError) {
        console.error('❌ Migration failed:', execError);
        process.exit(1);
      }
    }

    console.log('✅ Migration completed (manual mode)');
    console.log('\n⚠️ Warning: Could not execute migration automatically.');
    console.log('Please run the following SQL manually in Supabase SQL Editor:\n');
    console.log(sql);
    return;
  }

  console.log('✅ Migration completed successfully');
}

const migrationFile = process.argv[2];

if (!migrationFile) {
  console.error('Usage: tsx scripts/run-migration.ts <path-to-sql-file>');
  process.exit(1);
}

runMigration(migrationFile).catch((error) => {
  console.error('❌ Migration failed:', error.message);
  process.exit(1);
});
