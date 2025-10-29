# Supabase SETUP

1. Supabaseで新しいプロジェクトを作成する（プロジェクト名は自由で良い）
2. SQLエディタで `infra/supabase/schema.sql` の内容を適用する
   - organizations / profiles / activity_logs が作成されること
   - コメントは削除しない（RLS前提・owner一人制・activity_logs必須など）
3. プロジェクト設定から以下を取得し、ルートの `.env.local` に設定する:
   - SUPABASE_URL=
   - SUPABASE_ANON_KEY=
   - SUPABASE_SERVICE_ROLE_KEY=
4. ローカル開発時は次のドメイン/ポートで各アプリを起動する:
   - www.local.test:3001
   - app.local.test:3002
   - admin.local.test:3003
   - ops.local.test:3004
5. Cookie は `Domain=.local.test` 前提で発行する予定。
   - ポートが違っても `.local.test` のCookieは共有される。
   - SameSite=None; Secure は本番用の挙動（ローカルHTTPではSecure Cookieは送られない点に注意）。
