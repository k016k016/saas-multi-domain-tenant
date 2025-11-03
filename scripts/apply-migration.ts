/**
 * マイグレーションを手動で適用するスクリプト
 *
 * 使い方:
 * tsx scripts/apply-migration.ts
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// .env.testファイルから環境変数を読み込む
config({ path: '.env.test' });

async function main() {
  // 環境変数の検証
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error('Missing environment variable: NEXT_PUBLIC_SUPABASE_URL');
  }
  if (!serviceRoleKey) {
    throw new Error('Missing environment variable: SUPABASE_SERVICE_ROLE_KEY');
  }

  console.log('🔧 Applying migration to fix profiles_select_policy...');
  console.log(`🌐 Supabase URL: ${url}`);

  // Service Role Key で Admin API を使用
  const supabase = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // マイグレーションファイルを読み込む
  const migrationSQL = readFileSync(
    'infra/supabase/migrations/20251102000000_fix_profiles_select_policy.sql',
    'utf-8'
  );

  console.log('📝 Executing migration SQL...');

  // SQLを実行（複数のステートメントをセミコロンで分割して実行）
  const statements = migrationSQL
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith('--'));

  for (const statement of statements) {
    if (statement.trim()) {
      console.log(`Executing: ${statement.substring(0, 50)}...`);
      const { error } = await supabase.rpc('exec_sql' as any, {
        sql: statement,
      } as any);

      if (error) {
        // rpc('exec_sql')が存在しない場合は、ダイレクトにSQLを実行
        console.log('Using direct SQL execution...');
        try {
          // @ts-ignore - using internal method
          const response = await fetch(`${url}/rest/v1/rpc/exec`, {
            method: 'POST',
            headers: {
              apikey: serviceRoleKey,
              Authorization: `Bearer ${serviceRoleKey}`,
              'Content-Type': 'application/json',
              Prefer: 'return=minimal',
            },
            body: JSON.stringify({ query: statement }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(
              `Failed to execute SQL: ${response.status} - ${errorText}`
            );
          }
          console.log('✅ Statement executed successfully');
        } catch (execError) {
          console.error('❌ Failed to execute statement:', execError);
          throw execError;
        }
      } else {
        console.log('✅ Statement executed successfully');
      }
    }
  }

  console.log('🎉 Migration applied successfully');
}

main().catch((error) => {
  console.error('❌ Migration failed:', error.message);
  process.exit(1);
});
