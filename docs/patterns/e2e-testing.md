E2Eテストの目的は「動くかどうか」ではなく「境界が破られていないか」を確認すること。
特に、ドメインごとの分離（www/app/admin/ops）とロールごとの分離（member/admin/owner/ops）、org_idによるテナント分離、RLS前提、Server Actionの返却フロー、activity_logsの記録義務は壊さない。

## 1. ローカルドメイン

`/etc/hosts` に以下を登録すること:

```text
127.0.0.1 www.local.test
127.0.0.1 app.local.test
127.0.0.1 admin.local.test
127.0.0.1 ops.local.test
```

* `localhost` は使わない。
* 4つとも127.0.0.1で構わない。
* ブラウザやPlaywrightは `www.local.test`, `app.local.test` ... という別オリジンとして扱う。

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

* セッションCookieは将来的に `Domain=.local.test`（本番は`.example.com`）で発行し、サブドメイン間(app/adminなど)で共有する想定。
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
* 任意のorgを選択するとServer Actionが `{ success: true, nextUrl: "/dashboard" }` のようなレスポンスを返すこと。
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

## 最終原則

* E2Eテストは「機能が動くか」だけでなく「境界が壊れていないか」を見るもの。
* 単一アプリ統合案・RLS OFF・owner不在org・Server Actionでのredirect・wwwをゲートウェイにする、といったショートカットは全部NGとして扱う。
* これらは仕様違反であり、"一時的に許容" することはしない。
