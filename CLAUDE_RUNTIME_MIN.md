# CLAUDE_RUNTIME_MIN

あなたは以下の前提・禁止事項を絶対に破らないこと。  
曖昧な場合に勝手に「簡略化」「統合」「リネーム」するのは禁止。  
詳細仕様は CLAUDE_RUNTIME_FULL.md にある。あなたの提案・生成物はFULLとも矛盾してはならない。

## 1. ドメイン分離
4つのドメインは役割が違う。混ぜないこと。

- www  
  外向けLPとログイン導線。顧客データを出さない。ダッシュボードは置かない。
- app  
  日常業務UI。member / admin / owner 全員が使う。現場の仕事・自分の情報・組織切替。  
  支払い・凍結・owner権限の譲渡などの破壊系操作はここに置かない。
- admin  
  組織の管理・請求・凍結・権限管理。admin / owner が入る。memberは403。  
  ユーザー管理(CRUD)、ロール変更、支払い情報、組織凍結/廃止、owner権限譲渡などの重い操作はここ。
- ops  
  SaaS提供側の内部用。今回はダミーページだけで中身は実装しない。

禁止:
- 「全部appにまとめます」「adminいらなくないですか？」のような再設計提案
- 支払い変更・組織凍結・owner譲渡などの重い操作をapp側に置く提案

## 2. ロールモデル
ロールは固定。勝手に増やしたり統合しないこと。

- member  
  現場ユーザー。appに入れる。自分のデータだけ扱える。他ユーザー管理や組織設定UIは見えない。
- admin  
  member権限をすべて含む。adminドメインに入れる。同一組織内ユーザーのCRUDとmember/adminロール切替ができる。  
  ただし支払い情報変更 / 組織凍結・廃止 / owner権限の譲渡はできない。
- owner  
  admin権限をすべて含む。1組織に必ず1人。削除不可、譲渡のみ。  
  追加で、支払い情報変更 / 組織の凍結・廃止 / admin権限の付け替え / owner権限の譲渡ができる。  
  これらの操作は必ず監査ログ(activity_logs)に記録されるべきものとして扱う。
- ops  
  事業者側ロール。opsドメインに入る想定。今回はダミーのみで機能は作らない。

階層は `member ⊂ admin ⊂ owner`。opsは別枠。  
`superadmin` や `manager` のような新ロールを発明しない。

禁止:
- adminにowner専用操作（支払い変更・組織凍結・owner譲渡など）を許す提案
- memberにadminドメインを見せる提案

## 3. マルチテナント / org_id コンテキスト
- 1ユーザーは複数組織(org)に所属できる。
- ユーザーは「現在アクティブな組織(org_id)」を切り替えられる (`/switch-org`想定)。
- 現在のorg_idはサーバー側セッション＋Cookieに保持する。
- middlewareはorg_idを前提にアクセス制御する。この前提を勝手に削らない。
- DBはSupabase/Postgresで、org_idを使ってRLSする前提。  
  RLSを無効化・バイパス・「テスト用に全件見せる」は禁止。

禁止:
- 「RLSは一旦オフります？」という提案
- 「全テナントをひとまずまとめて一覧で見れるようにしましょう」という提案
- owner不在の組織を作る提案  
  → 各組織には常にownerが1人必要。owner不在状態はテスト用でも作らない。

## 4. Server Action と遷移
- Server Actionは `{ success: boolean, error?: string, nextUrl: string }` のようなオブジェクトを返す。
- Server Action内で `redirect()` は禁止。
- 画面遷移はクライアント側で `router.push(nextUrl)` 等を使って行う。

禁止:
- Server Actionから直接`redirect()`する実装

## 5. activity_logs
以下の操作は activity_logs に必ず記録する前提でUIとAPIを設計すること:
- 組織切替
- adminによるユーザー管理（CRUD / ロール変更）
- ownerによる支払い情報変更 / 組織凍結・廃止 / owner権限の譲渡 / admin権限の付け替え

禁止:
- 「ログは後回しでいいですよね」という提案

## 6. インフラと認証
- このリポジトリは Supabase(Postgres/RLS) と Next.js(App Router)/Vercel を前提とする。
- 認証・サインアップ・課金処理はまだ実装しない。  
  代わりに `getCurrentOrg()` / `getCurrentRole()` はハードコードのダミーでよい。
- opsドメインの本格機能は実装しない（ダミーページだけ）。

禁止:
- 「本番ログインフロー入れときました」「Stripe課金入れますね」など勝手な拡張

## 7. ブランチ / デプロイ運用
- `develop` ブランチ: 日常開発用。VercelのPreview環境に対応する。
- `main` ブランチ: 安定版。VercelのProduction環境に対応する。
- フローは `feature/<name>` → `develop` → `main`。
- `main` に直接push/commitする提案は禁止。
- PreviewとProductionを1本のブランチに統一する簡略化提案は禁止。

---

このMINに従わないコード生成・修正提案は無効。  
あなた（Claude）は「簡略化」「統合」「権限バイパス」を勝手に行ってはならない。  
詳細仕様・背景は CLAUDE_RUNTIME_FULL.md を参照し、矛盾させないこと。