E2Eテスト パターン

PlaywrightでのE2Eテストは「本番と同じ前提での挙動確認」を目的とする。
動けばいい・一時的に通ればいい・ロールを一時的に書き換えればいい、という発想は禁止。

このファイルと ../test-data/README.md のルールは両方守ること。

⸻

ドメイン / URL ルール
	•	localhost は使わない。禁止。
	•	必ずサブドメイン（.local.test等）でアクセスすること。
	•	URLは .env.local の値を参照し、ハードコードしないこと。

例（.env.localから取得）:
	•	process.env.NEXT_PUBLIC_APP_URL
	•	process.env.NEXT_PUBLIC_ADMIN_URL
	•	process.env.NEXT_PUBLIC_OPS_URL

理由:
	•	本番と同じマルチドメイン挙動（Cookie共有、権限分岐、middlewareのリダイレクト）をテストするため。
	•	localhost で通るテストは信用しない。
	•	.env.local の値を参照することで、プロジェクトごとのドメイン設定に対応。

テストコード内に http://localhost:3000 を書く提案はすべて却下する。

⸻

ログイン戦略

原則
	•	既にseed済みのテストユーザを使ってログインする。
	•	組織・ロール（owner / admin / member）はseed時点のものをそのまま使う。
	•	例: test_user_admin@example.com など
	•	テスト中にロールを付け替えて通そうとしない。
	•	**ops権限はorgロールとは別枠**。admin/owner/memberと混ぜない。

目的:
	•	「admin権限があるユーザで管理画面に入れるか」
	•	「member権限しかないユーザは拒否されるか」
これを確認するためのE2Eなので、ロール昇格で無理やり通すのは無意味。

ログイン方法について
	•	毎回UIからログイン画面を踏む必要はない。
	•	E2Eでは、ADR-003で定義されたE2E専用のログインバイパスを使って「特定のseedユーザとしてログイン済みの状態」をセットしてからテスト開始してよい。
	•	これはテストの安定性と速度のために許可される公式手段。
	•	このバイパスはE2E専用。本番やステージング本番相当では無効であることが前提。
	•	middlewareを緩める/RLSを外す/if (TEST) { return admin } みたいな独自の抜け道を勝手に作る提案はすべて禁止。
	•	使っていいのは公式に定義されたE2Eログインバイパスだけ。

サインアップフローだけは例外
	•	「ユーザ登録フローそのもの（サインアップ画面→初回セットアップ）」をテストする場合だけ、テスト内で新規ユーザを作ってよい。
	•	その場合のメールは毎回ユニークにすること。

形式:
	•	e2e+<yyyyMMddHHmmss>@example.com
	•	例: e2e+20251025T130455@example.com

禁止:
	•	同じメールを再利用する
	•	既存ユーザをDELETEして「再登録のために空ける」
	•	ownerを消して組織を壊す

これらはCI全体を赤くする元凶なので絶対にやらない。

⸻

セレクタの書き方

必須
	•	Playwrightではアクセシビリティベースで要素を取得すること。
	•	getByRole()
	•	getByLabel()
	•	getByText()（静的文言が安定している場合のみ）

例:

await expect(
  page.getByRole('heading', { name: '運用ダッシュボード' })
).toBeVisible();

await page.getByRole('button', { name: '保存' }).click();

禁止
	•	.className での直接指定
	•	div > span:nth-child(2) のような構造依存セレクタ
	•	ランダムっぽいクラス名（TailwindやCSS-in-JS由来）に依存した指定

理由:
	•	見た目の調整やリファクタで壊れやすい。
	•	role / アクセシビリティ名は実際のUI意図を表しており安定する。

⸻

ページ遷移と待機（Firefox / WebKit 対応）

Chromiumだけで動いて満足するな。FirefoxとWebKitで落ちやすいのは「表示前にassertしてる」パターン。

ページ遷移後はこれを入れること：

await page.waitForLoadState('domcontentloaded');

これは特に以下のケースで必須：
	•	ログイン直後のダッシュボード読み込み
	•	ドメインを跨ぐ遷移（app→adminなど）
	•	重い初期ロードがある画面

waitForLoadState('networkidle') のような過度な待機は基本不要。domcontentloaded が標準。

⸻

ダイアログ（confirm / alert 等）の扱い

ダイアログを伴う操作（削除ボタンなど）をテストするときは、クリック前 にハンドラを登録しておくこと。

やるべき書き方（OK）:

page.once('dialog', async dialog => {
  await dialog.accept();
});

await page.getByRole('button', { name: '削除' }).click();

やってはいけない書き方（NG）:

await page.getByRole('button', { name: '削除' }).click();
// ❌ その後で page.on('dialog', ...) を設定する

理由:
	•	ブラウザによってはクリック直後に即ダイアログが出るため、
後からハンドラをつけると間に合わない。

⸻

describe / test の命名ルール

テスト名は以下3段構成を徹底すること：

<ドメイン> - <機能> › <シナリオ> › <期待される結果>

例:

組織切り替え - AUTH_FLOW_SPECIFICATION準拠 › 権限がない組織への切り替え › エラー表示
OPSドメイン - 運用ダッシュボード › ダッシュボード表示 › 正しく表示される

理由:
	•	レポートを見ただけで、どの責務のどの振る舞いが壊れたのかを特定できるようにする。
	•	「なんか失敗した」ではなく「どこが壊れたか」を明文化する。

⸻

最小サンプル

import { test, expect } from '@playwright/test';

test('OPSドメイン - 運用ダッシュボード › ダッシュボード表示 › 正しく表示される', async ({ page }) => {
  // ops向けユーザでログインする処理（seedユーザを使うこと）
  // loginAsOps(page) などのヘルパーを使う想定

  await page.goto(process.env.NEXT_PUBLIC_OPS_URL + '/dashboard');
  await page.waitForLoadState('domcontentloaded');

  await expect(
    page.getByRole('heading', { name: '運用ダッシュボード' })
  ).toBeVisible();

  await expect(
    page.getByRole('button', { name: '更新' })
  ).toBeEnabled();
});

このサンプルが守っていること：
	•	.env.local の値を参照してドメインにアクセスしている
	•	waitForLoadState('domcontentloaded') を入れている
	•	getByRole を使っている
	•	権限は事前にseedされたユーザを想定しており、テスト中に昇格させていない

⸻

Claudeへの禁止事項まとめ

ClaudeがE2Eテストを書くとき・直すときにやってはいけないこと：
	•	http://localhost:3000 を使う提案
	•	seedユーザのロールや所属組織をテスト中に書き換える提案
	•	ownerロールを削除して「オーナー不在の組織」を作ろうとする提案
	•	既存ユーザ/組織をDELETEしてテストを”初期化”しようとする提案
	•	CSSクラスやnth-childセレクタに依存した操作
	•	Firefox/WebKitでの待機なしに expect(...).toBeVisible() を即座に叩く提案
	•	confirmダイアログのハンドラをクリック後に登録する提案

これらを提案してきた場合、その提案は却下すること。