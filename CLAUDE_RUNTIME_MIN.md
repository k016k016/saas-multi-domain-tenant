# CLAUDE_RUNTIME_MIN

あなたは以下の前提・禁止事項を絶対に破らないこと。  
曖昧な場合に勝手に「簡略化」「統合」「リネーム」するのは禁止。  
詳細仕様は CLAUDE_RUNTIME_FULL.md にある。あなたの提案・生成物はFULLとも矛盾してはならない。

## 1. アプリ構成（4ドメイン = 4独立Next.jsアプリ）
- `apps/www`, `apps/app`, `apps/admin`, `apps/ops` は**独立したNext.jsアプリ**。統合提案禁止。
- ネスト構造禁止: `apps/www/app/admin/...` → NG。正: `apps/admin/app/...`
- 本番は4アプリを独立デプロイ（Vercelで4プロジェクト、Root Directory分離）
- 「全部1つのNext.jsでhostヘッダ振り分け」設計は禁止
- **middlewareは各アプリ専用。wwwがadminをrewriteするゲートウェイ方式は禁止**

ドメインの役割:
- www: 外向けLPとログイン導線。顧客データを出さない。
- app: 日常業務UI。member / admin / owner 全員が使う。支払い・凍結・owner譲渡などの破壊系操作は置かない。
- admin: 組織の管理・請求・凍結・権限管理。admin / owner が入る。memberは403。
- ops: SaaS提供側の内部用。今回はダミーページのみ。

禁止:
- 「全部appにまとめます」「adminいらなくないですか？」のような再設計提案
- 支払い変更・組織凍結・owner譲渡などの重い操作をapp側に置く提案

## 2. 役割とアクセス境界
- ロール: member / admin / owner / ops のみ（増やさない）。階層は `member ⊂ admin ⊂ owner`。opsは別枠。
- adminドメイン: admin or owner以外403。middlewareで強制拒否。
- owner専用操作（支払い変更・組織凍結/廃止・owner権限譲渡など）はadmin側のみ、app側に置くな。

禁止:
- adminにowner専用操作を許す提案
- memberにadminドメインを見せる提案（テストでも緩めない）

## 3. マルチテナント / org_id / RLS
- 全データはorg_idでスコープされるマルチテナント。1ユーザーは複数orgに所属できる。
- 現在のorg_idはサーバー側セッション＋Cookieに保持する。
- middlewareは各アプリが自分専用。org_idを前提にアクセス制御する。この前提を勝手に削らない。
- DBはSupabase/Postgresで、RLS必須。RLS無効化・バイパス・「テスト用に全件見せる」は禁止。
- owner不在禁止（1組織に必ず1人、削除不可、譲渡のみ）。テスト用でも作らない。

禁止:
- 「RLSは一旦オフります？」「全テナントをまとめて見れように」という提案
- 「wwwのmiddlewareが全ドメインをrewriteする」旧構成の復活

## 4. Server Actionの約束
- Server Actionは `{ success: boolean, error?: string, nextUrl: string }` を返す。
- Server Action内で `redirect()` は禁止。画面遷移はクライアント側（`router.push(nextUrl)`等）で行う。

禁止:
- Server Actionから直接`redirect()`する実装

## 5. activity_logs
以下の高リスク操作は activity_logs に必ず記録する前提で設計すること:
- 組織切替
- adminによるユーザー管理（CRUD / ロール変更）
- ownerによる支払い情報変更 / 組織凍結・廃止 / owner権限の譲渡 / admin権限の付け替え

禁止:
- 「ログなくていい」「後ででいい」という提案

---

このMINに従わないコード生成・修正提案は無効。  
あなた（Claude）は「簡略化」「統合」「権限バイパス」を勝手に行ってはならない。  
詳細仕様・背景は CLAUDE_RUNTIME_FULL.md を参照し、矛盾させないこと。

---

補足（Edge/Node分離の最重要ルール）:
- middleware は Edge Runtime 固定。`@repo/db` や `next/headers::cookies()` を使わない。
- 認可やDBアクセスの本検証は Node ランタイム（Route/Server Action/Page）で行う。
- Server Action で `redirect()` は使わず、`{ success, nextUrl }` を返す。