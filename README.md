# saas-multi-domain-tenant-starter

このリポジトリは、**マルチテナント / マルチドメイン構成のSaaSスターター**です。  
Supabase(Postgres/RLS) と Next.js(App Router) / Vercel を前提に、SaaS事業の土台（権限モデル・ドメイン分割・監査ログ・組織コンテキスト）を最初から固めます。

このリポジトリは「完成アプリ」ではありません。  
ログイン / サインアップ / 請求課金 / 本番の業務ロジックはあえて入れていません。そこは各プロダクト側で実装してください。


## 目的

- 複数の顧客組織（テナント）を1つの基盤上で安全にホストする前提を、最初から入れる
- 組織ごとに責任の重さが違うUIを分離する (www / app / admin / ops)
- ロール階層 (member ⊂ admin ⊂ owner、opsは事業者側) を明文化して壊させない
- 現在アクティブな `organization_id` をアプリ全体のコンテキストにして、ユーザーが所属組織を切り替えられる
- 支払い変更・組織凍結・owner権限の譲渡など、組織レベルの重い操作は監査ログ(activity_logs)に必ず残す文化を入れる

簡単に言うと「権限と責任の境界が崩れないSaaSの背骨」です。


## ドメイン構成

4つのドメインを想定し、それぞれ役割が異なります。この分離は崩さないでください。

### www
- 公開LP・プロダクト説明・ログイン導線などの外向けサイト。
- 認証済みデータを見せない。ダッシュボードは置かない。
- 想定: `www.example.com`

### app
- 日常業務UI。`member` / `admin` / `owner` 全員が使う。
- 現場作業・自分のタスク・自分のプロフィール・組織切替などを扱う。
- 組織の支払い情報変更 / 凍結 / owner譲渡のような「組織そのものを壊す操作」は置かない。
- 想定: `app.example.com`

### admin
- 組織の管理・請求・リスク領域。`admin` と `owner` がアクセスできる（`member` は403）。
- やること:
  - 組織内ユーザー管理 (CRUD)
  - ロール変更 (member/admin の付け替え)
  - ownerのみができる操作:
    - 支払い情報の変更
    - 組織の凍結 / 廃止（状態遷移）
    - admin権限の付け替え
    - owner権限の譲渡（新オーナー指名、元オーナーは降格）
  - これらは `activity_logs` に記録される前提
- 想定: `admin.example.com`

### ops
- 事業者側（SaaS提供側）の内部コンソール領域。
- 今回は "internal only / ops only" と表示するダミーページだけ置く。実機能は実装しない。
- 想定: `ops.example.com`


## ロールモデル（権限階層）

ロールは固定です。勝手に変えないでください。

### member
- 現場ユーザー。
- `app` にログインできる。
- 自分の業務データを登録・閲覧できる。
- 他ユーザー管理や組織設定には触れない。そういうUIは見えない。

### admin
- `member` の権限をすべて含む。
- 組織の運用管理者。
- `admin` ドメインにアクセスできる。
- 同一組織内ユーザーのCRUD（招待/更新/無効化、member/adminロール切替）ができる。
- ただし以下はできない：
  - 支払い情報の変更
  - 組織の凍結 / 廃止
  - owner権限の譲渡

### owner
- `admin` の権限をすべて含む。
- 組織の代表。1組織に必ず1人。削除不可、譲渡のみ。
- 追加でできること:
  - 支払い情報の変更
  - 組織の凍結 / 廃止（状態遷移）
  - admin権限の付け替え
  - owner権限の譲渡（新オーナーに引き継ぐと自分は降格）
- これらの操作は `activity_logs` に必ず記録する。

### ops
- 事業者側の社内ロール。
- `ops` ドメインに入る想定。
- このスターターでは機能未実装（ダミーページのみ）。

階層は `member ⊂ admin ⊂ owner`。`ops` は別枠。  
`superadmin` や `manager` のような独自ロールは作らないこと。


## マルチテナント / 組織コンテキスト

このプロジェクトは**マルチテナントSaaS**を前提としています。

- 1ユーザーは複数の組織(org)に所属できる。
- ユーザーはUIで「現在アクティブな組織(org_id)」を切り替えられる。
- 現在のorg_idはサーバー側セッションとCookieに保持する。middlewareはそのorg_idを前提に動く。
- 取得・表示するデータは常に「現在のorg_id」でスコープされる。
- DBはSupabase/Postgresで、行ごとにorg_idで区切るRLSを前提にする。
- RLSを外す・バイパスする・“テストのために全件見せる”といった運用は許容しない。

監査(=activity_logs)を前提にする:
- 組織切替
- adminによるユーザー管理（CRUD / ロール変更）
- ownerによる支払い変更 / 組織凍結・廃止 / owner権限の譲渡 / admin権限の付け替え  
これらはすべて `activity_logs` に書く文化で進める。


## スケルトンとしてv0で入るもの

v0のゴールは「骨格と契約を成立させること」。業務機能は入れない。

1. **ディレクトリ構成**
   - `apps/www`
   - `apps/app`
   - `apps/admin`
   - `apps/ops`
   - `packages/config`
   - `packages/db`
   - `infra/supabase`
   - `docs/`
     - `docs/domains.md` … 各ドメインの責務まとめ
     - `docs/spec/tenancy.md` … マルチテナント/RLS/ロール仕様
   - `CLAUDE_RUNTIME.md` … Claudeに守らせる制約
   - `.env.example`
   - `README.md` (このファイル)

2. **各ドメインの最小ページ**
   - www: `/`  
     LPダミー。説明と「ログインへ」ボタンのプレースホルダ。
   - app: `/dashboard`  
     現在のorg_idとroleを表示する。
   - app: `/switch-org`  
     組織切替UIのプレースホルダ。Server Actionで `{ success, nextUrl }` を返すコメントを入れる。Server Action側で`redirect()`しない。
   - admin: `/overview`  
     組織サマリ（org名・状態などダミー）。
   - admin: `/members`  
     組織内ユーザー管理UIの骨。adminはCRUD可、ownerはさらに権限付け替え可というコメントを入れる。
   - admin: `/org-settings`  
     owner専用。支払い情報変更 / 組織凍結・廃止 / owner権限の譲渡などを行う画面の骨。これらの操作はactivity_logsに記録されるべき、と明記する。
   - ops: `/`  
     "internal only / ops only" とだけ表示するダミー。

   全ページで `getCurrentOrg()` と `getCurrentRole()` を呼び、結果を出す。  
   これにより「org_idとroleを前提に画面が変わる」という思想がコードで見える。

3. **コンテキスト取得のダミー実装**
   - `packages/config/getCurrentOrg()` → `{ orgId: 'dummy-org-id' }` を返す
   - `packages/config/getCurrentRole()` → `{ role: 'owner' }` などを返す
   - 将来はSupabaseのセッションからorg_id/roleを解決する予定であること、middlewareがorg_id前提で動くことをコメントに残す。

   これが「仮ログイン状態」。本物の認証やサインアップはまだ入れない。

4. **Supabaseスキーマ雛形**
   - `infra/supabase/schema.sql` を作り、以下のテーブルを定義する:
     - `organizations`
     - `profiles`
     - `activity_logs`
   - ファイル冒頭にコメントで
     - マルチテナントであること
     - org_idでRLSする前提であること
     - ownerは各orgに必ず1人で、削除不可で譲渡のみで交代すること
     - activity_logsは組織切替やadmin/ownerの重要操作を記録すること
     - RLSポリシーは `TODO` で、今は書かないこと
     を明記する。

5. **.env.example**
   次のキーだけ宣言しておく（値は空でよい）:
   - `NEXT_PUBLIC_WWW_URL=`
   - `NEXT_PUBLIC_APP_URL=`
   - `NEXT_PUBLIC_ADMIN_URL=`
   - `NEXT_PUBLIC_OPS_URL=`
   - `SUPABASE_URL=`
   - `SUPABASE_ANON_KEY=`
   - `SUPABASE_SERVICE_ROLE_KEY=`
   - `OPENAI_API_BASE=`
   - `OPENAI_API_KEY=`
   - `SENTRY_DSN=`

   これらはコード内で直接ベタ書きしないこと（環境変数経由で参照する設計にする）。

6. **認証/課金はまだ入れない**
   - サインアップ/ログインフローはビジネスモデル依存なので未実装。
   - 課金や請求処理も未実装。
   - 代わりに `getCurrentOrg()` / `getCurrentRole()` のダミーで「誰として / どの組織として動いているか」をUIに見せる。


## ブランチ / デプロイ運用

このリポジトリは `main` と `develop` の2本を基本とします。

- `main`  
  - 安定ブランチ。  
  - 公開・デモしてよい状態のみを置く。  
  - VercelのProduction環境に対応することを想定。

- `develop`  
  - 日常的な開発ブランチ。  
  - VercelのPreview環境に対応することを想定。  
  - 新機能・変更はまずこちらに統合される。

開発フロー:
1. 機能追加や修正は `feature/<name>` ブランチで作業する。
2. `feature/<name>` を `develop` にマージする。
3. `develop` が安定したタイミングで `main` にマージする。
   - このタイミングでProduction環境を更新する。

注意:
- `main` に直接コミットしない。
- `develop` は「壊れていてもいい場所」ではない。Preview環境として第三者に見せる前提で保つ。


## AIアシスタントとの連携について

このリポジトリでは、コード生成やファイル追加をAIアシスタントに依頼することを前提にしています。

- `CLAUDE_RUNTIME_MIN.md`  
  Claudeなどのアシスタントにタスクを依頼する際に、毎回一緒に渡す前提・禁止事項の短縮版。  
  ドメイン分離(www/app/admin/ops)、ロール階層(member/admin/owner/ops)、マルチテナント(org_idとRLS)、  
  Server Actionでredirect禁止、activity_logs必須、ブランチ運用(main/develop)といった壊しちゃいけない条件がまとまっている。

- `CLAUDE_RUNTIME_FULL.md`  
  上記の詳細版。初期スケルトン生成や大きな改修など、重い依頼を出すときに渡す。

運用ルール:
- ふだんの小さな変更依頼は `CLAUDE_RUNTIME_MIN.md` を貼ってから依頼すること。
- 大きい変更（ディレクトリ構成や権限境界に触る系）は `CLAUDE_RUNTIME_FULL.md` を貼ってから依頼すること。
- これらのファイルに書かれているルール（ドメイン責務や権限モデル、RLS前提など）を壊す提案は受け入れないこと。

## これは何ではないか

- これはフル製品ではない。
- これは汎用UIキットでもない。
- これは「全部1ドメインにまとめてシンプルにしました」というサンプルでもない。
  - www / app / admin / ops は責務が違う。混ぜないこと。
- これは「権限をごまかしてmemberに全部見せる」系の簡易デモでもない。
  - adminとownerの責務は明確に分ける。ownerだけが触れる領域がある。
  - その操作はすべてactivity_logsに残す。

このスターターの価値は「分離と監査」です。それを崩さないでください。