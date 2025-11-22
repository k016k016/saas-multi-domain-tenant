E2Eテストの目的は「動くかどうか」ではなく「境界が破られていないか」を確認すること。
特に、ドメインごとの分離（www/app/admin/ops）とロールごとの分離（member/admin/owner/ops）、org_idによるテナント分離、RLS前提、Server Actionの返却フロー、activity_logsの記録義務は壊さない。

## 1. ローカルドメイン

`/etc/hosts` に以下を登録すること:

```text
127.0.0.1 www.local.test
127.0.0.1 app.local.test
127.0.0.1 acme.app.local.test
127.0.0.1 contoso.app.local.test
127.0.0.1 admin.local.test
127.0.0.1 ops.local.test
```

* `localhost` は使わない。
* すべて127.0.0.1で構わない。
* ブラウザやPlaywrightは `www.local.test`, `app.local.test`, `acme.app.local.test` ... という別オリジンとして扱う。

禁止:

* `http://localhost:3000` に全部まとめてテストする。
* `localhost:3000/admin` みたいなURLでadminを触る。

これは本番構成と乖離し、ドメイン境界テストが無効になるのでNG。

## 2. ローカルポート

各アプリは別ポートで `next dev` を起動してよい:

* `apps/www`   → `www.local.test:3001`
* `apps/app`   → `app.local.test:3002`
* `apps/admin` → `admin.local.test:3003`
* `apps/ops`   → `ops.local.test:3004`

1ポートに統合するためのリバースプロキシやgatewayを今は作らない。
`www` をゲートウェイに昇格させないことが重要。

## 3. クッキー / SSO想定

* セッションCookieは `Domain=.local.test`（本番は`.example.com`）で発行し、サブドメイン間(www/app/admin/ops および orgサブドメイン)で共有する。
* ただしアクセス可否は各アプリのmiddlewareが決める。

  * `admin.local.test` は `admin` / `owner` 以外403。
  * `member` が`admin` 画面を見れたらテスト失敗。

この「403が正しい相手には403が返るか」をE2Eで確認する。

## 4. middlewareの検証

* 各アプリは自分専用の `middleware.ts` を持ち、他ドメインの認可やrewriteを肩代わりしない。
* E2Eでは以下を最低限確認する:

  * `app.local.test`: `member`/`admin`/`owner` でアクセスできる。
  * `admin.local.test`: `admin`/`owner` はOK、`member` は403。
  * `ops.local.test`: `ops` 以外を拒否する（将来前提でもコメント込みでチェック）。
  * `www.local.test`: 公開系。ここには内部管理UIを混ぜない。

禁止:

* `www` のmiddlewareが他ドメインへのrewriteを行う構成。
  それを前提にしたテストは書かない。

## 5. org切り替えの検証

* `/switch-org` のような画面で所属org一覧が出ること。
* 任意のorgを選択するとServer Actionが `{ success: true, nextUrl: "https://acme.app.local.test:3002/dashboard" }` など、対象 org のサブドメインを前提にしたURLを返す、もしくは現在の org サブドメインを前提とした相対パスを返すこと。
* クライアント側で `router.push(nextUrl)` すること。
* Server Action内で `redirect()` を呼んでいないこと。
* 所属していないorg_idを指定すると `{ success: false, error: "...", nextUrl: "/unauthorized" }` が返り、`/unauthorized` 側に遷移すること。

## 6. activity_logs の検証

* adminドメインで行う高リスク操作（ユーザー招待、ロール変更、請求更新、組織凍結/廃止、owner権限の譲渡、admin権限の再割当など）は `activity_logs` に残す前提になっているかをテストで担保する。
* 「今回はデモだからログなしでOK」というパスを作らない。PRレビュー時に落とす。

## 7. URL / 環境変数

* テストコードでドメインやポートを直書きしない。
  `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_ADMIN_URL`, ... のような環境変数を参照させる。
* これは将来 `apps/app` を `apps/portal` にリネームしてもテストが壊れないようにするためでもある。

---

## 8. E2Eテスト実行手順 【重要】

正しいE2Eテスト実行には以下の手順を**必ず順番通り**に実行すること:

```bash
# 1. プロセス停止（既存サーバーをすべて終了）
lsof -ti:3001,3002,3003,3004 | xargs kill -9 2>/dev/null
pkill -f "pnpm dev" 2>/dev/null

# 2. キャッシュクリア（古いビルドキャッシュとテスト結果を削除）
rm -rf apps/*/.next .turbo playwright-report test-results

# 3. テストユーザー作成（重要：seed:allの前に必ず実行）
pnpm setup:e2e  # ← これがないと認証エラーで全テストが失敗する！

# 4. データセットアップ（組織・プロファイル等のseed）
pnpm seed:all

# 5. サーバー再起動
pnpm dev

# 6. 待機（サーバー起動完了を待つ - 必須）
sleep 40  # すべてのアプリ（www/app/admin/ops）の起動完了を待つ

# 7. テスト実行（全フェーズ一括実行）
pnpm test:e2e:p1 && pnpm test:e2e:p2 && pnpm test:e2e:p3 && pnpm test:e2e:p4
```

### フェーズ別実行（デバッグ時）

```bash
pnpm test:e2e:p1  # Phase 1: Baseline（31テスト）
pnpm test:e2e:p2  # Phase 2: Members & Audit（46テスト）
pnpm test:e2e:p3  # Phase 3: OPS & Orgs（49テスト）
pnpm test:e2e:p4  # Phase 4: Boundary & RLS（46テスト）

# 特定のファイルのみ実行
pnpm test:e2e:p2 e2e/tests/p2-members-audit/admin/org-settings.spec.ts

# 特定のテストケースのみ実行（行番号指定）
pnpm test:e2e:p2 e2e/tests/p2-members-audit/admin/org-settings.spec.ts:17
```

### 重要な注意点

* **`pnpm setup:e2e` を忘れると「Invalid login credentials」で全テスト失敗**
  * `seed:all` は組織とプロファイルのみ作成
  * `setup:e2e` がテストユーザーのパスワードを設定（`scripts/seed-test-user.ts`）
* **プロセス停止とキャッシュクリアは必須**
  * 前のセッションの残留プロセスが干渉する
  * キャッシュが原因で古いコードが実行される場合がある
* **40秒の待機時間は必須**
  * 4つのアプリ（www/app/admin/ops）すべての起動完了を待つ
  * 待機不足だとサーバー未起動でテストが失敗する
* **テストはフェーズ順に実行**
  * p1が失敗している場合、まずp1の問題を解決してからp2へ
  * 全フェーズ一括実行は `&&` で連結し、失敗時に即停止

## 最終原則

* E2Eテストは「機能が動くか」だけでなく「境界が壊れていないか」を見るもの。
* 単一アプリ統合案・RLS OFF・owner不在org・Server Actionでのredirect・wwwをゲートウェイにする、といったショートカットは全部NGとして扱う。
* これらは仕様違反であり、"一時的に許容" することはしない。
