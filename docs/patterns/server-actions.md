Server Actions パターン

Server Action の責務は「検証 → 権限チェック → DB更新 → 結果オブジェクトを返す」まで。
画面遷移は責務に含まれない。redirect() は禁止。

この方針から外れる提案は却下する。

**重要**: エラーメッセージの扱いについて
- 現時点では`error: string`としてユーザー向けメッセージ（日本語）を返す
- 将来的に`errorCode`ベース（例: 'UNAUTHORIZED' | 'NO_ORG'）に変更する可能性がある
- UIがサーバーの文面に依存しすぎないように設計すること

⸻

1. Server Actionの責務

Server Actionは以下を行う。
	1.	入力バリデーション
	•	クライアントから渡された値をそのまま信用しない
	•	必要に応じてスキーマバリデーションを行う（zod等）
	2.	権限チェック（重要）
	•	呼び出しユーザがそのリソースにアクセス可能かをサーバ側で確認する
	•	組織IDやロールは、必ずサーバ側で再確認する
	•	クライアントの「自分はadminです」等の主張は信じない
	3.	DB操作
	•	必要な更新・永続化を行う
	•	RLS前提の読み取りや更新は、プロジェクト側のポリシーに従う
	•	「とりあえず全件SELECTしてフロントでフィルタ」は禁止
	4.	結果オブジェクトの返却
	•	成功/失敗、次に遷移すべきURL、メッセージなどを返す

Server Actionはここまで。
ここから先（実際の画面遷移・トースト表示など）はクライアント側の責務。

⸻

2. redirect() 禁止

Server Action内で redirect() は使わない。

理由：
	•	マルチドメイン環境（app.local.test, admin.local.test, ops.local.testなど）では、
サーバ側リダイレクトは不安定かつ扱いが複雑になる。
	•	「どのドメインに遷移すべきか」は呼び出し側コンテキスト依存なので、
サーバ側が勝手に決めるべきではない。

代わりに、Server Actionは「この後どこへ行けばいいか」というURLを値として返す。

⸻

3. 戻り値の標準フォーマット

戻り値は基本的にこの形に揃えること。勝手に別の型名・フィールド名を発明しない。

export type ActionResult<T> =
  | {
      success: true;
      data?: T;           // 成功時のデータ（任意）
      nextUrl?: string;   // 遷移先がある場合のみ
    }
  | {
      success: false;
      error: string;      // ユーザ向けエラーメッセージ
      nextUrl?: string;   // エラー時の遷移先（任意）
    };

return {
  success: true,
  data: result,
  nextUrl: "/dashboard"
};

return {
  success: false,
  error: "権限がありません"  // UIに直接表示されるエラーメッセージ
};

禁止事項：
	•	return redirect("/dashboard")
	•	throw new Error("must be admin") のような「例外だけ返してUI側でなんとかして」は乱用しない
	•	明示的な success: false を使うこと

⸻

4. クライアント側での呼び出しパターン（期待形）

クライアント側（Client ComponentやUIロジック側）はこう書く。
Server Action内で遷移させず、戻り値を見てから自分で動く。

"use client";

import { useRouter } from "next/navigation";
import { updateProfile } from "@/app/actions/updateProfile";

export default function ProfileForm() {
  const router = useRouter();

  async function onSubmit(formData: FormData) {
    const result = await updateProfile(formData);

    if (result.success) {
      // 成功時にサーバーが示した遷移先があるならそこへ飛ぶ
      if (result.nextUrl) {
        // nextUrlが相対パスの場合
        if (result.nextUrl.startsWith('/')) {
          router.push(result.nextUrl);
        } else {
          // フルURL（クロスドメイン）の場合はlocation.assign()を使用
          window.location.assign(result.nextUrl);
        }
        return;
      }

      // nextUrlがない場合はそのまま画面内で完結させる
      // 例: トースト表示など
      return;
    }

    // 失敗時はエラーメッセージをUIに表示する
    // showError(result.error);
  }

  // ...フォームUI...
}

重要ポイント：
	•	クライアント側が router.push() を実行する。
	•	Server Actionに画面遷移を押し付けない。

⸻

5. よくある違反と禁止理由

違反1：クライアントから渡ってきた orgId をそのまま使って更新

// ❌ 危険
const { orgId } = formData; // クライアントが言ってきたorgId
await db.update("OrganizationSettings", { orgId, ... });

理由：
	•	ユーザが所属していないorgIdを渡せば、他組織を勝手に更新できてしまう。
	•	必ずサーバ側で「呼び出しユーザはこのorgIdに属しているか？ロールは？owner/admin/memberどれ？」を確認する。

違反2：RLS/権限確認をスキップして「後でやります」

// ❌ 後で制限入れる予定です、は通用しない
const rows = await db.select("*").from("Projects"); // 全件
// あとはフロントでフィルタしましょう

理由：
	•	それは漏洩。

違反3：Server Action内で redirect()

// ❌ 禁止
redirect("/admin/dashboard");

理由：
	•	複数ドメイン間遷移をサーバ側が勝手に決めるのは不安定。
	•	我々は「結果を返す / 遷移はクライアント」のモデルを前提にしている。

⸻

6. Claudeへの指示
	•	Server Actionは「権限まで含めてサーバ側で最終チェックする場所」であり、
クライアントの主張を信じる場所ではない。
	•	Server Actionは「結果オブジェクトを返す場所」であり、
その場で redirect() を実行する場所ではない。
	•	クライアント側は router.push() で遷移する。Server Actionは遷移しない。
	•	このルールを変えたい場合は、必ずADRを追加してから議論すること。