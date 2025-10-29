# マルチテナント / org_id / RLS / 監査ポリシー

このSaaSは「1つのDBを複数組織(org)で共有する」マルチテナント設計である。  
データアクセスは常に `org_id` でスコープされ、RLS (Row Level Security) を前提とする。  
この前提は開発中・テスト中でも外さない。

## org とユーザー

- 1ユーザーは複数のorgに所属できる。
  - 例: A社のadmin兼B社のmember。
- 現在アクティブなorgは、セッション（クッキー経由）で保持される `current_org_id` として決まる。
- アプリ（appドメインなど）は常に「現在のorg_idコンテキストでデータを見る・書く」。

### ownerの扱い
- 各orgには必ず `owner` が1人存在する。
- `owner` は削除不可。
- `owner` の交代は「owner権限の譲渡」という明示的な手続きで行う。
  - 現オーナーが後任を指名し、自分は降格する。
- `owner` がいないorg状態をテストで再現しようとするのは禁止（仕様外状態とみなす）。

### role
- ロールは固定:
  - `member`: 現場の通常ユーザー
  - `admin`: 組織の運用管理者
  - `owner`: 組織の代表（各orgに常に1名）
  - `ops`: SaaS提供者側サポート/監査
- これ以外のロールを勝手に足さない。
- `admin` ↔ `member` の付け替えは `admin` / `owner` が行える。
- `owner` 付与/剥奪は通常のロール変更ではなく、`owner` 譲渡フローのみで行う。

---

## RLS (Row Level Security)

- DBはPostgres/Supabaseを想定し、RLSは必須。
- すべての行は `org_id` を持つ前提で設計する。
- 「RLSをOFFにして全部見えるようにしてデバッグしましょう」「ops画面からは全orgを直接生で見れるようにしましょう」という提案は仕様違反。
- あくまで「ユーザーの今のorg_idに対してだけ行を返す」が正しい。

`infra/supabase/schema.sql` の方針:
- `organizations`
  - `id uuid primary key`
  - `name text`
  - `plan text`
  - `is_active boolean`
  - `created_at timestamptz`
- `profiles`
  - `id uuid primary key`
  - `org_id uuid`
  - `role text`  (`member` | `admin` | `owner` | `ops`)
  - `metadata jsonb`
  - `updated_at timestamptz`
- `activity_logs`
  - `id bigserial primary key`
  - `org_id uuid`
  - `user_id uuid`
  - `action text`
  - `payload jsonb`
  - `created_at timestamptz default now()`

`-- TODO: RLS policies` というコメントで止めておき、RLSポリシーは後続で定義する。ただし「RLSはあとでやります、今日は無効化でいいでしょ」は禁止。  
RLS抜きの動作確認を正当化するのは、このプロジェクトの思想自体を壊すので不可。

---

## 組織の切り替え (organization switching)

- ユーザーは、自分が所属している複数orgの中から、現在アクティブなorgを切り替えられる。
- 切り替え後のorg_idはサーバ側セッション/クッキーに保持され、app側はそのorgコンテキストで動作する。
- フロー:
  1. `/switch-org` のような画面に所属org一覧を表示する。
  2. ユーザーが選んだorgをServer Actionに渡す。
  3. Server Actionは
     - ユーザーがそのorgに所属しているかを検証する（所属していないorg_idは拒否）
     - セッション上の `current_org_id` を更新する
     - `{ success: true, nextUrl: "/dashboard" }` のような戻り値を返す
  4. クライアント側が nextUrl へ遷移する。
- ポイント:
  - Server Action内で `redirect()` しない。`{ success, nextUrl }` だけ返す。
  - アクセス権がないorgを指定した場合は `{ success: false, error: "...", nextUrl: "/unauthorized" }` のように返す。
  - middlewareは「いまのorg_idは有効か？」を前提に動作するので、勝手にmiddlewareをゆるめて「とりあえず通しときました」はダメ。

---

## activity_logs と監査

- 重要操作はすべて `activity_logs` に残す。
- 対象とする操作の例:
  - ユーザー招待
  - ロール変更 (`member` ↔ `admin`)
  - 請求情報の変更
  - 組織の凍結/廃止（= is_active の状態遷移）
  - owner権限の譲渡
  - admin権限の再割り当て
- これらは基本的に `admin` ドメイン（= admin/ownerだけが触れるUI）から実行されるべきで、`app` ドメイン側には置かない。
- 「ログは後でまとめて」「今は動けばいい」は仕様違反。監査が前提文化。

---

## middleware とアクセス制御

- 各ドメイン(app / admin / ops / www)はそれぞれ独立したNext.jsアプリであり、それぞれが独自の `middleware.ts` を持つ。
- middlewareの責務:
  - そのアプリが許すロール以外を403にする
  - セッションから `current_org_id` を引き、なければ弾く（app/adminなど）
- 禁止事項:
  - `www` 側でサブドメインやパスを見て `admin` 側にrewriteするなど、1つのアプリをゲートウェイ化すること。
  - appの中にadminの画面をコピーして「便利だからまとめました」とすること。

これらは「権限ごとにartifactを分離する」目的であり、コストや実装の手間を理由に統合しない。

---

## 要約

- すべてのデータはorg_idでスコープされる。org_idはユーザーごとに切り替わる。
- ownerは各orgに必ず1人。削除不可。譲渡のみ。
- RLSは前提であり、RLSを外して全件を見る運用は許容しない。
- 高リスク操作（請求・凍結・owner交代など）はadminドメインに集約し、activity_logsに必ず記録される。
- 各ドメイン(app/admin/ops/www)は別アプリとしてデプロイされ、middlewareも別に持つ。他ドメインを肩代わりしない。

このルールを崩す提案（単一アプリ化、RLS無効化、権限統合、ログ省略など）はすべてNG。