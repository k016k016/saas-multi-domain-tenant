# CONTRIBUTING_AI.md

これはAIアシスタントへの運用ルールです。  
勝手にいじってよい範囲と、いじってはいけない範囲を明確にします。

AIアシスタントは以下を絶対に守ること。

---

## 変更禁止ファイル / 要人間レビュー領域

次のファイルとその内容は、AIアシスタントが勝手に編集・リライト・再定義・上書きしてはいけない。

- `CLAUDE_RUNTIME_MIN.md`
- `CLAUDE_RUNTIME_FULL.md`
- `CONTRIBUTING_AI.md`
- `README.md`
- `docs/` 配下すべて
  - 例: `docs/domains.md`, `docs/spec/tenancy.md` など
- `infra/supabase/SETUP.md` はAIが勝手に変更しない

禁止内容:
- 文言の書き換えや言い回しの最適化
- 役割/責務の「整理」「再定義」
- 別のモデルへの統合提案（例: 「www/app/admin/opsをまとめましょう」等）
- ロール階層の変更（`member ⊂ admin ⊂ owner` / `ops`は別枠）
- ownerの扱いの緩和（「owner不在でもいい」等）
- RLSやorg_id境界の緩和（「テストのためRLS無効化」等）
- Server Action内での `redirect()` 許可といったルール緩和
- middlewareを削除・簡略化・1ドメイン統合する提案
- activity_logs(監査ログ)を「後でいい」とする提案
- ブランチ戦略の変更（`feature/*` → `develop`(Preview) → `main`(Production)）

AIアシスタントは、上記の領域を「改善」「整理」「簡略化」「一体化」などの名目で書き換えないこと。  
変更案を提示すること自体も禁止する。  
これらは人間オーナーのみが編集する。

---

- 各アプリ(`apps/www`, `apps/app`, `apps/admin`, `apps/ops`)は独立したNext.jsアプリ。
  それぞれが自分のmiddleware.tsだけを持つ。
  - `www` が他ドメイン(admin/app/ops)へのrewriteや認可を肩代わりする案は提出禁止。
  - 1つのアプリに4ドメインを統合して、host名で画面を出し分ける案も禁止。

---

## 変更してよい領域

以下の範囲は、AIアシスタントがコードや構成案を生成・修正してよい。

- `apps/` 以下のアプリコード  
  (`apps/www`, `apps/app`, `apps/admin`, `apps/ops`)  
  - `page.tsx`, `layout.tsx`, routing, components, server actionsの雛形など
  - ただし `redirect()` はServer Action内で使わず、`{ success, nextUrl }` を返す方針を必ず守ること
  - `member` に `admin`/`owner` 専用UIを見せるような提案をしないこと
  - `app` ドメインに請求・凍結・owner権限譲渡などを置く提案はしないこと
  - `admin` ドメインには `admin`/`owner` のみ入れることを前提にUIを書くこと（`member` は403）

- `packages/` 以下のユーティリティやダミー実装  
  例: `getCurrentOrg()`, `getCurrentRole()` のハードコードなど  
  - ここでは「将来Supabaseのセッションからorg_id/roleを読む予定」「middlewareがorg_idを前提に動く」というコメントは消さないこと
  - RLSやtenant境界を壊すようなサンプルを入れないこと

- `infra/supabase/schema.sql` の追記  
  - 既存のテーブル定義・コメントの前提を壊さない範囲で、新しいカラムやテーブル案を追加するのは許可する  
  - ただしRLSを外す / owner不在を許す / activity_logsを不要にする方向の改変は不可  
  - `-- TODO: RLS policies` の方針（RLS必須）は絶対に維持すること  

- 新しいドキュメントの「追加」は許可  
  - 例: `docs/spec/new-feature-x.md` のような新規ファイルを提案するのは構わない  
  - ただし `docs/` 既存ファイルの書き換え・差し替えは禁止（上記の「変更禁止ファイル」扱い）

---

## 出力形式のルール

AIアシスタントは以下のように回答すること:

1. 既存ファイルを書き換えないでほしい場合  
   → 「追加するならこの新規ファイル案です」など、追加提案だけを返す。  
   既存ファイルをまるごと再掲して“修正版”として提示しない。

2. どうしても docs や README に関連する修正が必要な場合  
   → 「この1行を人間が追記することを提案します」という差分だけを示す。  
   既存ドキュメントの全面リライトは禁止。

3. 「ドメイン統合」「ロール統合」「RLSバイパス」「owner省略」「Server Actionでredirect許可」など、  
   ルールを緩める提案は出してはならない。

---

## ブランチ運用ルール (AI側が守ること)

- コード生成結果や修正案は、`feature/<name>` ブランチに対して適用する前提で提案すること。
- `develop` ブランチはPreview環境に対応するため、直接壊す前提の提案をしないこと。
- `main` ブランチ (Production相当) に対して直接コミット・マージする提案は禁止。

---

AIアシスタントは以上を前提に作業すること。  
これに反する提案・出力は無効とする。
 
## Edge Middleware ルール（必読）
- middleware は Edge Runtime 固定。**@repo/db の import 禁止**。
- DB 接続・Supabase クライアント生成・`next/headers::cookies()` 使用は禁止。
- 認可の本検証は **サーバ側 (nodejs runtime)** で実施すること。
- Server Action は **redirect() 禁止**。**{ success, nextUrl }** を返す。

## ドキュメント編集ポリシー
- `docs/**` と `CLAUDE_RUNTIME*.md` は**無断変更禁止**。変更時は PR に理由と対象箇所を明記。

## Cookies / Runtime ルール
- Server側（Route/Action/RSC）は **`await cookies()` 必須**。同期扱い禁止。
- middleware では `next/headers` 禁止。`NextRequest/NextResponse.cookies` を使う。
- middleware で **@repo/db import 禁止**（ESLint/CIで強制）。
- Server Action は **redirect() 禁止**。`{ success, nextUrl }` を返す。

> Cookie/Sessionの細則は `docs/patterns/cookies-and-sessions.md` を参照。