このリポジトリは、**マルチテナント / マルチドメイン構成のSaaSスターター**です。  
Supabase(Postgres/RLS) と Next.js(App Router) / Vercel を前提に、SaaSの土台（権限モデル、ドメイン分割、監査ログ、組織コンテキスト）だけを先に固めます。

これは完成品アプリではありません。  
ログイン / サインアップ / 課金処理 / 本番業務ロジックはまだ入れません。そこは各プロダクト側で決めてください。


## 目的
- 複数の顧客組織（テナント）を1つの基盤で安全にホストする前提を、最初から持ち込む
- 組織ごとに責任の重さが異なるUIを分離する (www / app / admin / ops)
- ロール階層 (member ⊂ admin ⊂ owner、opsは事業者側) を固定し、勝手に変えさせない
- アクティブな `org_id` をアプリ全体のコンテキストにして、ユーザーが所属組織を切り替えられるようにする
- 支払い変更・組織凍結・owner権限の譲渡など高リスク操作は、監査ログ(activity_logs)に必ず残す文化を最初から入れる

要するに「権限境界と責務分離と監査を最初から設計に焼き込んでおくためのスターター」です。


## ドメイン構成
4つのドメインを**独立したNext.jsアプリケーション**として分離する。この分離は崩さないでください。

### アプリ構成
- `apps/www` - 独立したNext.jsアプリ
- `apps/app` - 独立したNext.jsアプリ
- `apps/admin` - 独立したNext.jsアプリ
- `apps/ops` - 独立したNext.jsアプリ

各アプリは独立したpackage.json、next.config.js、tsconfig.jsonを持ち、**本番では別々にデプロイ**されます。

### www
- LP / プロダクト説明 / サインアップ・ログイン導線（将来的）
- 認証済みの業務データや内部情報は表示しない
- ダッシュボードを置かない
- 本番: `www.example.com`（Vercelプロジェクト: Root=`apps/www`）

### app
- 日常業務UI。`member` / `admin` / `owner` 全員が使う
- 自分の業務データ、進捗、プロフィール、通知、所属組織の切り替えなど
- アクティブなorg_idのコンテキストで動く
- 組織を壊す操作（支払い変更・凍結・owner譲渡など）は置かない
- 本番: `app.example.com`（Vercelプロジェクト: Root=`apps/app`）

### admin
- 組織運用・契約・高リスク系操作のUI
- `admin` / `owner` が入れる。`member` は403（middlewareで強制拒否）
- adminができること:
  - 同一組織内ユーザーのCRUD（招待 / 更新 / 無効化）
  - member/adminロール切り替え
- ownerだけができること:
  - 支払い情報の変更
  - 組織の凍結 / 廃止（状態遷移で扱う）
  - admin権限の付け替え
  - owner権限の譲渡（新オーナーを指名し、自分は降格）
- 上記のowner専用操作はすべて `activity_logs` に記録する前提
- 本番: `admin.example.com`（Vercelプロジェクト: Root=`apps/admin`）

### ops
- SaaS提供側（ベンダー側）の内部コンソール
- 将来的には複数組織を横断したサポート/監査を行う場所
- 現時点の雛形では "internal only / ops only" のダミーページのみ用意する
- 現段階ではRLSをバイパスするような横断閲覧機能は実装しない
- 本番: `ops.example.com`（Vercelプロジェクト: Root=`apps/ops`）

### デプロイ方針
本番環境では、4アプリを**独立してデプロイ**します。

- Vercelでは同一リポジトリから4つのプロジェクトを作成し、Root Directoryを分ける
- 分割理由: セキュリティ・監査・ロールバック分離・権限境界の明確化（コスト理由で崩さない）
- **禁止**: 「全部1つのNext.jsプロジェクトにまとめてhostヘッダで振り分ける」設計

### Middlewareの責務
各アプリは**自分専用のmiddleware.ts**を持ち、他ドメインの責務を肩代わりしません。

- `apps/www/middleware.ts`: www専用（外向けLPなので緩い制御）
- `apps/app/middleware.ts`: app専用（member/admin/owner全員OK、org_id必須）
- `apps/admin/middleware.ts`: admin専用（admin/owner以外403。memberをadmin画面に入れないのは仕様、テストでも緩めない）
- `apps/ops/middleware.ts`: ops専用（ops以外403）

**重要**: wwwがadminにrewriteする集約型middlewareは採用しません。各アプリは独立して動作します。

### Cookie共有とアクセス制御
将来的に、`*.example.com` / `*.local.test` のようなサブドメイン間で `Domain=.example.com` クッキーを共有してSSO的な動作を可能にする方針があります。

ただし、Cookieを共有しても、アクセス可否は**各ドメインのmiddlewareで個別に判定**して403を返すため、セキュリティを保ちます。例: memberがadmin.example.comにアクセス → Cookieは共有されているが、adminのmiddlewareが403で拒否。

### 重要な禁止事項
- 「全部appにまとめたほうがシンプル」は却下
- 「全部1つのNext.jsでhostヘッダ振り分け」は却下
- memberにadmin画面を見せる、は却下
- owner専用操作（支払い変更・凍結・owner譲渡など）をapp側に置くのは却下
- admin権限とowner権限をごちゃ混ぜにする提案も却下
- apps/www/app/admin/... のようなネスト構造は禁止


## ロールモデル（権限階層）
ロールは固定。新しいロールを勝手に発明しない。  
階層は `member ⊂ admin ⊂ owner`。`ops` は別枠のベンダー側。

### member
- 現場ユーザー
- app にログインして自分の業務データを扱う
- 他ユーザー管理・組織設定には触れない
- adminドメインには入れない（403）

### admin
- memberの権限をすべて含む（つまりappも使える）
- adminドメインに入れる
- 組織内ユーザーのCRUD（招待 / 更新 / 無効化）やmember/adminロール切り替えができる
- ただし、支払い変更 / 組織の凍結・廃止 / owner譲渡 はできない

### owner
- adminの権限をすべて含む
- 組織の代表。1組織に必ず1人だけ。オーナー不在の組織は作らない（テスト時も禁止）
- 削除不可。交代は「owner権限の譲渡」で行う（新オーナーを指名し、自分は降格）
- 追加でできること:
  - 支払い情報の変更
  - 組織の凍結 / 廃止（状態遷移）
  - admin権限の付け替え
  - owner権限の譲渡
- これらはすべて `activity_logs` に記録するべき操作

### ops
- 事業者側ロール
- opsドメインにアクセスする想定
- この雛形ではダミーページのみ。実業務機能・RLSバイパスはまだ入れない


## マルチテナント / 組織コンテキスト
このプロジェクトは**マルチテナントSaaS**が前提。

- 1ユーザーは複数の組織(org)に所属できる
- ユーザーは「現在アクティブな組織(org_id)」をUIから切り替えられる
- 現在のorg_idはサーバー側セッション＋Cookieで保持される
- すべてのデータ取得・表示は「いまのorg_id」のコンテキストで行われる
- middlewareはorg_idを前提にしてアクセス制御・ガードを行う  
  → middlewareを「テストしやすいからオフ」「全部1ドメインでよくない？」みたいにするのは不可
- DBはSupabase/Postgresを前提とし、行ごとにorg_idを持たせRLSでスコープする  
  → 「とりあえずRLSオフで全件見えるようにする」は不可

監査文化 (activity_logs):
- 組織切替
- adminが行うユーザー管理操作（招待 / 無効化 / ロール変更など）
- ownerが行う高リスク操作（支払い変更 / 組織凍結 / 組織廃止 / owner権限の譲渡 / admin権限の付け替え）
これらはすべて `activity_logs` に残す前提で設計する。  
「ログはあとでいい」はなし。


## v0スケルトンで入るもの
v0のゴールは「骨格と契約（責務分離・権限境界・RLS前提・監査文化）」を共有可能な形にすること。  
実務ロジックや課金や本番Authまでは入れない。

1. ディレクトリ構成
   - `apps/www`
   - `apps/app`
   - `apps/admin`
   - `apps/ops`
   - `packages/config`
   - `packages/db`
   - `infra/supabase`
   - `docs/`
     - `docs/domains.md`
     - `docs/spec/tenancy.md`
   - `CLAUDE_RUNTIME_MIN.md`
   - `CLAUDE_RUNTIME_FULL.md`
   - `.env.example`
   - `README.md`

2. ページの骨
   - www: `/` … LPダミー
   - app: `/dashboard` … 現在のorg_idとroleを表示
   - app: `/switch-org` … 組織切り替えUIのプレースホルダ。Server Actionにorg_idを渡して `{ success, nextUrl }` を受け取る想定。Server Action内で`redirect()`は禁止とコメントしておく
   - admin: `/overview` … 組織サマリ表示
   - admin: `/members` … 組織内ユーザー管理の骨。adminはユーザーCRUD/ロール切替ができる、ownerはさらに権限付け替えできる、とコメントする
   - admin: `/org-settings` … owner専用。支払い変更 / 組織凍結・廃止 / owner権限の譲渡 / admin権限の付け替え。これらは `activity_logs` に記録されるべきとコメントする
   - ops: `/` … "internal only / ops only" とだけ表示するダミー

   すべてのページの先頭で `getCurrentOrg()` / `getCurrentRole()` を呼び、その戻り値 `{ orgId: string }` `{ role: 'member' | 'admin' | 'owner' | 'ops' }` を表示する  
   → 現状はこの2つが「仮ログイン状態」

3. `packages/config`
   - `getCurrentOrg()` / `getCurrentRole()` のダミー実装を置く
   - コメントで「将来的にはSupabaseセッションからorg_id/roleを決定する」「middlewareはorg_idベースで動くのでここを勝手に改造しない」と明記する
   - Server Actionは `{ success, nextUrl }` を返し、`redirect()` しないポリシーをコメントする

4. `infra/supabase/schema.sql`
   - テーブル定義だけ書く（RLSは `-- TODO: RLS policies` とコメントして止める）
     - organizations  
       - id uuid primary key  
       - name text  
       - plan text  
       - is_active boolean  
       - created_at timestamptz  
     - profiles  
       - id uuid primary key  
       - org_id uuid  
       - role text  -- 'member' | 'admin' | 'owner' | 'ops'  
       - metadata jsonb  
       - updated_at timestamptz  
     - activity_logs  
       - id bigserial primary key  
       - org_id uuid  
       - user_id uuid  
       - action text  
       - payload jsonb  
       - created_at timestamptz default now()
   - ファイル冒頭コメントに必ず書くこと:
     - これはマルチテナント前提であり全データはorg_idでスコープされる
     - 各ユーザーは複数orgに所属できる
     - 各orgには必ず1人のownerが存在し、owner不在orgは作らない
     - RLSは必須であり、RLSを外して全件見るような運用は許容しない
     - activity_logsは組織切替やadmin/ownerの高リスク操作を監査する目的

5. `.env.example`
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

   値は空でよい  
   コード側ではこれらを直接ハードコードしないこと（URLやキーはenv経由で読む想定）


## ブランチ / デプロイ運用
- `develop` ブランチ  
  - 日常開発用  
  - VercelのPreview環境に対応  
  - 新機能・変更はまずここに統合する

- `main` ブランチ  
  - 安定ブランチ  
  - VercelのProduction環境に対応  
  - デモ・共有して良い状態のみ置く

運用フロー:
1. 機能追加・修正は `feature/<name>` ブランチで作業する
2. `feature/<name>` → `develop` にマージする
3. `develop` が安定したら `main` にマージし、本番（Production）を更新する

禁止:
- `main` に直接push/commitする提案
- PreviewとProductionを1本のブランチにまとめる簡略化提案
- 「developは壊れててOK」という扱い  
  → developはPreview環境で他人に見せる想定なので、完全なゴミ状態にして良いわけではない


## AIアシスタントとの連携
このリポジトリはAIアシスタント（Claudeなど）にコード生成や修正を依頼する前提で運用する。

- `CLAUDE_RUNTIME_MIN.md`  
  - Claudeにタスクを依頼するとき、基本的に毎回これを一緒に貼る（短縮版ルール）  
  - ドメイン分離 (www/app/admin/ops)、ロール階層 (member ⊂ admin ⊂ owner、opsは別枠)、  
    マルチテナント(org_id + RLS必須)、Server Actionでredirect禁止、  
    activity_logs必須、ブランチ運用(`feature/*`→`develop`→`main`)など  
    壊したら終わるラインがまとまっている

- `CLAUDE_RUNTIME_FULL.md`  
  - 上記の詳細版（権限境界、middlewareの扱い、owner不在禁止などフル仕様）  
  - ディレクトリ構成や権限境界など、大きい変更・生成タスクをお願いする場合はこっちを渡す

運用ルール:
- 小さい修正（ページ1枚の変更など）は MIN を渡してから依頼する
- ルーティングや権限モデルやRLSに触るような大きい変更は FULL を渡してから依頼する
- MIN/FULLに反する提案（例: ドメイン統合、RLSバイパス、ownerをオプション扱い）は受け入れない

このルールをREADMEに明記しておくことで、未来の自分や他の開発者がAIに壊されるのを防ぐ


## これは何ではないか
- これは完成済みSaaSではない
- これは「全部appにまとめてシンプルにしました」みたいなチュートリアルではない
- これは「memberにも見えて便利な管理画面」を作るサンプルではない
- これは「RLSを一旦切って楽に動かしましょう」というやり方ではない
- これは「Server Actionから直接redirectしてラクにしましょう」というサンプルでもない
- これは**単一アプリに全ドメインを統合してmiddlewareで出し分ける系のサンプルではない**

このスターターの価値は、**分離・権限境界・マルチテナント・監査**が最初から揃っていること。  
そこを崩す提案は拒否する。