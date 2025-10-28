機能名: 組織切り替え (organization switching)

目的

ユーザーが所属組織の中から、現在アクティブな組織（organization_id）を切り替える。

このアクティブ組織はアプリ全体のコンテキストになる。

⸻

前提
	•	1ユーザーは複数の組織に所属できる。
	•	各組織には必ず owner が1人いる（owner不在の組織は存在しない前提）。
	•	現在のアクティブ組織IDはサーバー側セッションとCookieで保持する。
	•	middleware.tsはその値を前提に動く。middlewareの挙動を勝手に変更しないこと。

⸻

フロー（正常系）
	1.	ユーザーが「組織切り替え」UIを開く。
	2.	所属組織の一覧から1つを選ぶ。
	3.	Server Actionに組織IDを渡す。
	4.	Server Action側でその組織IDを現在アクティブな組織として保存する（セッション/Cookie更新）。
	5.	Server Actionは結果をJSON/オブジェクトで返す。サーバー側でredirect()しない。
	6.	クライアント側が返却値に含まれるnextUrlへ遷移する（router.push()など）。

返却の基本形:
{
  success: true | false,
  error?: string,
  nextUrl: string
}

権限制御
	•	member でも組織の切り替えは可能。
	•	ただし、ユーザーがその組織内でアクセス権を持たない領域（例: adminドメイン等）に遷移させてはいけない。
	•	アクセス不可の場合は以下のように返すこと:
  {
  success: false,
  error: 'この組織にはアクセス権がありません',
  nextUrl: '/unauthorized'
}

禁止事項 / 取り決め
	•	ユーザーが所属していない organization_id は拒否する。チェックを省かない。
	•	“owner不在の組織” という状態はテストしない・許容しない（仕様外）。
	•	権限を勝手に昇格させて通そうとしない（memberにadmin権限を仮付与してE2E通す等はNG）。
	•	middlewareのロジック（セッションのorg_idでドメイン振り分け等）を勝手に単純化しない。「テストのためにredirectを外す/緩める」は禁止。
	•	Server Action内でredirect()しないこと。必ずオブジェクトで返し、フロント側で遷移させること。
