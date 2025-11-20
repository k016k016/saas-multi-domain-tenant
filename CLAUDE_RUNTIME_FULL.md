# CLAUDE_RUNTIME_FULL

このファイルは Claude のための完全仕様です。  
あなたはここに書かれた内容と矛盾する提案・改変を行ってはならない。  
簡略化や統合と称して責務分離・権限境界・RLSを壊すのは禁止。

本リポジトリは、マルチテナント / マルチドメイン構成のSaaSスターターである。  
Supabase(Postgres/RLS) と Next.js(App Router) / Vercel を前提とする。

目的:
- 複数の組織(tenant)を1つの基盤で安全にホストする
- 責任と権限の重さに応じてUIを分割する (www / app / admin / ops)
- ロール階層 (member ⊂ admin ⊂ owner、opsは別枠) を固定して壊さない
- アクティブな organization_id をアプリ全体のコンテキストにする
- 重要操作は activity_logs に記録する文化を最初から埋め込む

---

## 1. ドメインの役割（混ぜないこと）

### www
- 外向けLPとログイン導線。
- 顧客データや内部情報を出さない。
- ダッシュボード的な機能は置かない。

### app
- 日常業務UI。
- `member` / `admin` / `owner` 全員がここを使う。
- 現場での入力・進行確認・自分のプロフィール・組織切り替えなど。
- 支払い情報編集・組織凍結・owner権限の譲渡など「組織そのものを壊す操作」は置かない。

### admin
- 組織の管理・請求・リスク領域UI。
- `admin` と `owner` のみアクセスできる。`member` は403にする。
- ここで行うこと:
  - 組織内ユーザー管理 (CRUD)
  - ロール変更 (member/admin の付け替え)
  - ownerだけが行える操作:
    - 支払い情報の変更
    - 組織の凍結 / 廃止（状態遷移）
    - admin権限の付け替え
    - owner権限の譲渡（新オーナー指名。元オーナーは降格）
  - これらは activity_logs に必ず記録されるべきものとして扱う

### ops
- 事業者側（SaaS提供者）の内部コンソール領域。
- 今回の雛形では "internal only / ops only" と表示するダミーページだけ用意し、実機能は実装しない。

禁止事項:
- 「全部appにまとめましょう」「adminいりませんよね？」など、ドメイン統合・責務統合の提案。
- 支払い変更や組織凍結/廃止、owner譲渡などの操作をapp側に置く提案。

---

## 2. ロールモデル（変更・追加・統合は禁止）

階層は `member ⊂ admin ⊂ owner`。`ops` は別枠。  
`superadmin` や `manager` のような新ロールの提案は禁止。  
既存ロールの統合・名称変更も禁止。

### member
- 現場ユーザー。
- `app` にログインできる。
- 自分の業務データを登録・閲覧できる。
- 他ユーザー管理や組織設定UIには触れないし、見えない。

### admin
- `member` の権限をすべて含む。
- 組織の運用管理者。
- `admin` ドメインにアクセスできる。
- 組織内ユーザーのCRUD（招待/更新/無効化、member/adminロール切替）ができる。
- ただし以下はできない：
  - 組織の支払い情報変更
  - 組織の凍結 / 廃止
  - owner権限の譲渡

### owner
- `admin` の権限をすべて含む。
- 組織の代表。1組織に必ず1人。削除不可。オーナー交代は「譲渡」のみ許可（新オーナーを指名し、自分は降格）。
- 追加でできること:
  - 支払い情報の変更
  - 組織の凍結 / 廃止（状態遷移）
  - admin権限の付け替え
  - owner権限の譲渡
- これらの操作は activity_logs への監査記録を必須とする。

### ops
- 事業者側の社内ロール。
- `ops` ドメインに入る想定。
- 今回の雛形ではダミーページのみで、機能自体は実装しない。

禁止事項:
- `member` に `admin` / `owner` のUIを見せる提案。
- `admin` に `owner` 専用操作（支払い・凍結・owner譲渡など）を許す提案。

---

## 3. マルチテナント / 組織コンテキスト

このプロジェクトはマルチテナントSaaSを前提とする。

- 1ユーザーは複数組織(org)に所属できる。
- ユーザーはUIでアクティブな組織(org_id)を切り替える。
- 現在のorg_idはDB（user_org_context）に保持する。
- middlewareはこのorg_idを前提にアクセス制御を行う。middlewareのロジックを「簡略化」の名目で勝手に変更/撤廃しない。
- DBはSupabase(Postgres)を前提とし、org_id単位でRow Level Security (RLS) を敷く。
- RLSを無効化・バイパスする・「テストなので全件見えるようにします」という提案は禁止。
- owner不在の組織状態は作らない。テスト目的でも禁止。各組織には常にownerが1人必要。

---

## 4. 組織切り替え (organization switching)

- `/switch-org` 相当のUIで、ユーザーは所属組織の中からアクティブな組織を選択できる。
- Server Actionは org_id を受け取り、  
  そのorg_idが本当にそのユーザーの所属組織であれば「現在のorg」として保存するイメージ。
- Server Actionの返り値は `{ success: boolean, error?: string, nextUrl: string }`。
- Server Action内で `redirect()` は禁止。  
  画面遷移はクライアント側で `router.push(nextUrl)` 等を使って行う。
- ユーザーが所属していないorg_idは拒否し、`success: false` と `nextUrl: '/unauthorized'` を返す設計にする。
- admin/owner専用UIへの遷移要求が、本来権限のないロールから来た場合も同様に拒否する。

禁止事項:
- 「memberでも見れるように一旦権限バイパスしますね」という提案。
- Server Actionから直接`redirect()`する実装。

---

## 5. activity_logs（監査ログ）

次の操作は必ず activity_logs に残すことを前提でUIとAPIを設計する：
- 組織切替（誰がどのorgに切り替えたか）
- adminによるユーザーCRUD / ロール変更
- ownerによる
  - 支払い情報の変更
  - 組織の凍結 / 廃止（状態遷移）
  - admin権限の付け替え
  - owner権限の譲渡

「今回はログなしでいいですよね」という提案は禁止。

---

## 6. Supabase / RLS / スキーマ

- DBはSupabase(Postgres/RLS)を前提にする。
- `infra/supabase/schema.sql` には最低限以下のテーブルを定義する：
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
- `schema.sql` の先頭にはコメントで、  
  - マルチテナントであること  
  - org_idでRLSすること  
  - ownerは各orgに必ず1人で削除不可、譲渡のみで交代すること  
  - activity_logsは監査目的であること  
  - RLSポリシーはTODOであり、無効化は許可しない  
  を明記する。
- RLSポリシー本体はまだ書かない。`-- TODO: RLS policies` で止める。

禁止事項:
- 「RLSを一時的に無効化して育てましょう」という提案。
- 1つのクエリで全orgを横断する読み取りを標準動作にする提案。

---

## 7. Server Action / redirect

- Server Actionはオブジェクトを返すだけ（例 `{ success, nextUrl }`）。
- その中で `redirect()` は禁止。
- 画面遷移はフロント側（`router.push(nextUrl)`等）で行う。

禁止事項:
- Server Actionから直接リダイレクトする実装を提案すること。

---

## 8. アプリ構成（4つの独立Next.jsアプリ）

このプロジェクトは**4つの完全に独立したNext.jsアプリケーション**で構成される。

### 構成
- `apps/www` - 独立したNext.jsアプリ（外向けLP・ログイン導線）
- `apps/app` - 独立したNext.jsアプリ（日常業務UI）
- `apps/admin` - 独立したNext.jsアプリ（組織管理・高リスク操作）
- `apps/ops` - 独立したNext.jsアプリ（事業者側内部コンソール）

### 配置規則
- **ネスト構造禁止**: `apps/www/app/admin/...` のように1つのアプリ直下に他ドメインをぶら下げる構成は全面禁止
- **正しい配置**: `apps/admin/app/members/...` のように、adminの機能はadminアプリ内に配置する
- 各アプリは独立したpackage.json、next.config.js、tsconfig.jsonを持つ

### ローカル開発時の起動方法

各アプリを独立したポートで起動する：

```bash
# ターミナル1
cd apps/www && npm run dev    # ポート 3001

# ターミナル2
cd apps/app && npm run dev    # ポート 3002

# ターミナル3
cd apps/admin && npm run dev  # ポート 3003

# ターミナル4
cd apps/ops && npm run dev    # ポート 3004
```

または、モノレポのルートから：

```bash
pnpm --filter www dev &
pnpm --filter app dev &
pnpm --filter admin dev &
pnpm --filter ops dev &
```

#### アクセスURL

- http://www.local.test:3001
- http://app.local.test:3002
- http://admin.local.test:3003
- http://ops.local.test:3004

#### /etc/hosts 設定

以下を `/etc/hosts` に追加：

```
127.0.0.1 www.local.test
127.0.0.1 app.local.test
127.0.0.1 admin.local.test
127.0.0.1 ops.local.test
```

#### Cookie共有の前提

- `Domain=.local.test` のCookieは、`app.local.test:3002` や `admin.local.test:3003` のようにポートが違っていても共有される。ポート番号はCookieのスコープ判定条件ではない。

- つまり、ローカルでもサブドメイン間SSO的な動作は基本的に再現できる想定。

- ただし本番相当の挙動を完全に再現するには別の問題がある：
  - 本番ではクロスサブドメインでCookieを送るために `SameSite=None; Secure` を付ける必要がある。
  - `Secure` が付いたCookieはHTTPSでしか送れないので、ローカルHTTP環境だと本番と同じ条件では動かない場合がある。

- そのため、将来的に本番同等のSSOテストをする場合は以下のような対応が必要になる可能性はある：
  1. ローカルでHTTPS終端するリバースプロキシ（Caddy/nginx等）を立てる
  2. 4アプリをそれぞれサブドメインで公開し、TLS付きで動かす
  3. またはE2E専用の検証環境（Vercel Previewなど）でまとめて検証する

- **重要**: 「ポートが違うからCookie共有できない」は誤りなので、それを理由に1アプリ統合やwwwゲートウェイ化を正当化しないこと。

### 本番デプロイ
- 本番環境では4アプリを**独立してデプロイ**する
- Vercelでは同一リポジトリから4つのプロジェクトを作成し、Root Directoryを分ける想定
  - www.example.com → Vercel Project (Root: `apps/www`)
  - app.example.com → Vercel Project (Root: `apps/app`)
  - admin.example.com → Vercel Project (Root: `apps/admin`)
  - ops.example.com → Vercel Project (Root: `apps/ops`)
- **4アプリ分割の理由**: 監査・権限境界・障害分離のため。コスト理由で統合しない
- **禁止**: コスト理由での統合提案
- **禁止**: 1つのNext.jsアプリでhostヘッダやmiddlewareで分岐する案（セキュリティ・監査・ロールバック分離・権限境界を崩すため）

禁止事項:
- 「全部1つのNext.jsプロジェクトにまとめてhostヘッダで振り分けましょう」という提案
- アプリ間でルーティング知識を共有する設計（例: wwwがadminのルーティングを知っている）

---

## 9. middleware.ts（各アプリ専用）

各アプリは**自分専用のmiddleware.ts**を持つ。他ドメインの責務を肩代わりしない。

### 各アプリのmiddleware責務

- **apps/www/middleware.ts**
  - wwwドメイン専用の制御のみ
  - 外向けLPなので基本的に緩い（ログイン不要）
  - **admin/app/opsのルーティング・認可を肩代わりしない**（wwwが他のアプリにrewriteするゲートウェイ方式は禁止）

- **apps/app/middleware.ts**
  - appドメイン専用
  - member / admin / owner 全員OK
  - org_id必須（将来的に）
  - ログイン状態とorg_idがあることを確認

- **apps/admin/middleware.ts**
  - adminドメイン専用
  - admin または owner 以外は **403 を返す**
  - memberがadminにアクセスしようとした場合は強制拒否
  - これは仕様であり、テストであっても緩めない

- **apps/ops/middleware.ts**
  - opsドメイン専用
  - opsロール以外は **403 を返す**
  - 本格機能は未実装だが、アクセス制御は必ず実装する
  - **注意**: opsは「RLSをバイパスする神ビュー」ではない。現段階はダミーページのみで、横断閲覧機能は実装しない

### 禁止事項
- **旧構成の復活**: 「apps/www/middleware.tsがサブドメインを見て全ドメインをrewriteする」という設計は破棄済み。復活させるな。
- 「テストを楽にするためmiddlewareを緩めます」「1ドメインに集約しましょう」といった提案
- middlewareの挙動（org_idで判定する前提）を勝手に簡略化・削除・別方式に置き換えること
- 他アプリのアクセス制御を肩代わりする設計

---

## 10. Cookie共有とアクセス制御

### Cookie共有
- 将来的にサブドメイン間でログイン状態を共有する方針
- 設定例: `Domain=.example.com`（ローカル開発: `Domain=.local.test`）
- これにより `*.example.com` 間でSSO的な動作が可能

### アクセス制御の分離
- **Cookie共有 ≠ どこでも入れる**
- Cookieを共有しても、アクセス可否は**各アプリのmiddlewareで個別に判定**して403を返す
- 例: memberがadmin.example.comにアクセス → Cookieは共有されているが、adminのmiddlewareが403で拒否
- これにより、セキュリティとSSOを両立する

禁止事項:
- 「SSOのために全部1アプリにまとめましょう」という提案（Cookie共有とアプリ統合は別物）

---

## 11. 認証 / サインアップ / 課金

- 認証、サインアップ、課金処理はまだ実装しない。
- `getCurrentOrg()` / `getCurrentRole()` はダミー（ハードコード）でよい。
- それを「仮ログイン状態」として扱い、UI上に現在のorg_idとroleを表示する。
- Stripe等の課金ロジックや外部SaaS請求周りを勝手に注入しない。

禁止事項:
- 「本番ログインフロー入れておきました」系の拡張提案。
- 「請求プランをStripeと自動連携するコードも作っておきました」系の提案。

---

## 12. ブランチ運用 / デプロイ先

- ブランチ戦略:
  - `develop` ブランチは日常開発用。VercelのPreview環境に対応。
  - `main` ブランチは安定版。VercelのProduction環境に対応。
  - 基本フローは `feature/<name>` → `develop` → `main`。
- `main` に直接push/commitを促す提案は禁止。
- PreviewとProductionを1本のブランチに統合する「簡略化」提案は禁止。
- Claudeはブランチ戦略やデプロイ戦略を勝手に再設計しないこと。

---

## 13. Data-First Debug / Preflight（仕様）

デバッグ・E2E失敗調査の初手は**データ不整合の排除**。コードや待機条件の調整はその後に限る。  
**adminは admin/owner のみ許可。member は 403**（リダイレクトで誤魔化さない）。

### 13.1 必須プレフライト（CI/ローカル共通）

以下4点が**すべて pass でなければ作業を続行しない**。値の漏洩を避け、存在・整合のみ確認する。

- ENV 存在チェック（例: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`）
- パスワード認証（GoTrue password grant で `access_token` を取得できること）
- membership 実データ（`auth.admin`で `user.id` → `memberships(role)` がテスト前提と一致すること）
- org_id クッキー共有（`Domain=.local.test`, `Path=/`, `SameSite=Lax`。HTTP環境では `Secure` を付けない）

13.2 観測項目（コマンド不要の運用基準）
デバッグ・調査の初手はデータ前提の健全性確認とする。以下の項目は“存在確認／整合性の説明”までを必須とし、手元の画面・ログ・設定値の根拠を言語化すること（数値や秘密値を出す必要はない）。
	•	環境変数の存在
必要キーがすべて設定済みであることを、名称ベースで確認・記録する（例：URL／Anon Key 等が“設定済み”で未設定はない、まで）。
	•	パスワード認証の成立
対象ユーザーでのパスワード認証が成功する事実を確認する。成功／失敗のどちらかを明言し、失敗時は“パス不一致”と断定して先に直す。
	•	membership とロールの一致
対象ユーザーの user.id と、対象組織でのロール（例：member / admin / owner）がテスト前提と一致していることを確認する。不一致ならテスト条件の誤りとして修正する。
	•	org_id クッキーの共有条件
サブドメイン間で参照できる属性（例：共通ドメイン指定・適切な SameSite・運用環境に応じた Secure）になっていることを確認する。共有されない属性であれば即修正。
	•	管理ドメインのミドルウェア適用
管理ドメインのリクエストが当該アプリのミドルウェアに到達している事実を確認する（適用範囲・マッチャ設定・応答経路の整合を文章で示す）。

13.3 判定ルール（続行／中止の基準）
	•	上記のいずれか1つでも未確認／不一致があれば、以降のコード調整・待機条件調整・テスト改変は中止する。
	•	すべて整合が取れていることを確認して初めて、実装や待機条件に踏み込む。

13.4 出力フォーマット（回答の型）
	•	DATA-CHECKS：各観測項目について「OK / 未確認 / 不一致」を簡潔に列挙（根拠の要約つき）
	•	ROOT-CAUSE：原因を1件に絞って短く断定
	•	FIX：直す順番を明確化（作業単位を番号で列挙。冗長禁止）

13.5 禁止事項
	•	データ前提が未確認のまま、待機時間の引き延ばし・待機条件の変更・ルーティングの小手先改変を提案しない。
	•	管理ドメインでの権限不足をリダイレクトでごまかさない。admin/owner 以外は 403 を返す（UIはその前提で設計）。

13.6 期待する最終状態
	•	「Cookieが共有できる＝入場OK」ではない。入場可否は各アプリのミドルウェアが組織ロールで判定する。
	•	“データの不整合を先に潰し、コード変更は最後”を徹底する。
  
---

あなた（Claude）は以上すべてを拘束条件とし、  
これらと矛盾する実装・修正方針・再設計提案をしてはならない。  
特に「簡略化」「わかりやすくするための統一」「テストのための一時的バイパス」を理由に、  
権限境界・テナント境界・監査・ドメイン責務を壊す行為は禁止。