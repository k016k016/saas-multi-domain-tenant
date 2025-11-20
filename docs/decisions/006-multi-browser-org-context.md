# orgコンテキストとURL設計に関する検討レポート（サブドメイン採用）

## 1. 概要

- **対象**: ADR-007: 組織コンテキストのDB管理（Cookie禁止）
- **論点**:
  - 「ユーザー単位の user_org_context（active org）＋DB解決」という従来の設計と、
  - 「サブドメインに org を埋め込んで、タブごと・ブラウザごとに別 org を扱えるようにする案」
- **結論**:
  - ADR-007 の方針（Cookie禁止・DB一元管理）は維持する
  - app ドメインにおいて `{orgSlug}.app.example.com` 形式の **サブドメイン方式を採用** し、ブラウザ／タブ単位で org を分離する
  - `user_org_context` は「サブドメイン未指定時のデフォルト org 決定」に限定して利用する

---

## 2. 現状（ADR-007の要点再整理）

- active org / role は **Cookieに保存しない**
- 組織コンテキストのソースオブトゥルースは DB（`user_org_context` / `organizations` / `memberships`）
- role は **毎リクエスト DB (`profiles`) から取得**
- 組織切替は DB の UPDATE のみ（Cookie操作なし）

**メリット**:
- 改ざん不可能（org_id / role がクライアントに出ない）
- role変更の同期ズレが発生しない
- RLS と併せて多層防御が構成しやすい
- 「orgコンテキストの真実」は常に DB 側に1箇所だけ

---

## 3. 複数ブラウザ / 複数タブ問題（従来方式）

- 従来の user_org_context は **「ユーザー単位で1つの active org」** を持つ設計だった
- その結果：
  - 同一ユーザーが複数ブラウザ／複数タブでログインしている場合、
    **最後に切り替えた組織が全クライアントに共有される（後勝ち）**
  - これはバグではなく、「グローバルなユーザーコンテキスト」としての挙動ではあるが、
  - 「タブAで org-A、タブBで org-B を同時に見たい」というユースケースとは相性が悪い
  - 特にサポート用途（A社とB社を並べて見る等）では不便であり、仕様として解消したいニーズが明確になった

---

## 4. 検討した選択肢

### 案1. Cookieベースに戻す（HMAC署名など）

- **内容**:
  - org_id / role を Cookie に復活
  - HMAC署名で改ざん対策
- **利点**:
  - ブラウザごと／タブごとの org 分離がしやすい
- **問題**:
  - 署名しても role変更の同期問題は残る
  - Cookie と DB の二重管理が復活し、ADR-007の趣旨と正面から衝突
- **評価**:
  - **不採用**。セキュリティ＆保守性の観点で後退になる。

---

### 案2. URL／パスに org を埋め込む（不採用）

例:
- `https://app.example.com/o/{orgSlug}/dashboard`
- `https://app.example.com/{orgSlug}/jobs`

**やることのイメージ**:
- organizations.slug 列を追加（英数＋ハイフンの短いコード）
- getCurrentOrg() を:
  1. URLの orgSlug → organizations から org_id を解決
  2. profiles / memberships で所属チェック
  3. 所属していない場合は 404 / 403
- user_org_context は /app 直アクセス時の「デフォルト org 決定」にだけ使う

**メリット**:
- タブA: `/o/acme/...`
- タブB: `/o/contoso/...`
  → 同一ユーザーでもタブごとに別 org を自然に扱える
- org / role の「真実」は依然として DB(＋RLS) 側にあり、ADR-007の思想と整合する

**コスト・影響**:
- ルーティング構造の変更（/dashboard → /o/[orgSlug]/dashboard 等）
- getCurrentOrg() / getCurrentRole() の実装差し替え
- org切替UIが「URLベース」に変わるので、E2Eテストの helper や baseURL の修正が必要

**評価**:
- 設計としてはきれいだが、ルーティング構造の全面変更とテスト影響が大きい
- サブドメイン方式（案3）と比べ、URLの視認性以外のメリットが小さいため **不採用**

---

### 案3. サブドメインに org を埋め込む（acme.app.example.com）※採用

- **例**:
  - `https://acme.app.example.com/dashboard`
  - `https://contoso.app.example.com/dashboard`
- **必要なこと（インフラ）**:
  - Vercel プロジェクトに `*.app.example.com` を追加
  - DNS に `*.app` の CNAME などワイルドカード設定
- **必要なこと（アプリ）**:
  - middleware で Host ヘッダから acme 部分を orgSlug として抽出
  - getCurrentOrg() で orgSlug → org_id 解決＋所属チェック
- **メリット/デメリット**:
  - メリットは案2とほぼ同等（タブごとに org 分離可能）
  - 追加で DNS / Vercel 設定が必須
  - Playwright 等のテスト環境でマルチホストを考慮する必要が出る

**評価**:
- インフラ＋アプリ＋テストに波及するが、orgごとの分離が明確であり、
  URLパス方式と比べてもユーザー体験・監査ログの観点でメリットが大きい
- app ドメインの責務範囲の中で完結し、ADR-001 / ADR-007 とも整合が取れるため **採用**

---

## 5. 今回の判断

- **構造変更（サブドメイン方式）を導入する（採用）**
- **ADR-007 の決定（Cookie禁止・DB一元管理）は維持** する
- app ドメインにおける org コンテキストは、以下の優先順位で決定する：
  1. Host ヘッダの orgSlug（`{orgSlug}.app.example.com`）
  2. サブドメインがない場合の user_org_context（ユーザー単位のデフォルト org）
- 複数ブラウザ／複数タブ時の挙動は、以下のように仕様として定義し直す：

> - アクティブな組織（active org）は、**「ユーザー×サブドメイン単位のコンテキスト」** として扱う
> - 同一ユーザーでも、`acme.app.example.com` と `contoso.app.example.com` を別タブで開けば、それぞれ独立した org コンテキストとなる
> - user_org_context は「どの org サブドメインに遷移するか」を決めるデフォルト情報としてのみ利用し、サブドメイン上のコンテキストは Host を優先する

---

## 6. 将来の検討トリガー（拡張・見直し条件）

以下のようなニーズが明確になった時点で、URL パス方式や別構成への再検討を行う：

- orgSlug を URL パスにも明示的に含めたい（例: `/o/{orgSlug}/...`）強い要求が出た場合
- ログ・監査・サポートの観点で、「パスに orgSlug を含める」ことのメリットがサブドメインのみ構成を上回ると判断される場合
- app 以外のドメイン（www / admin / ops）でも org ごとのサブドメインを張り出す必要が出てきた場合

その際は：
1. まず **URLパス方式（/o/{orgSlug}/...）** を app ドメイン内に併用する案を検討し、
2. それでも不足する場合に、他ドメインでの org サブドメイン導入可否を検討する

---

## 7. サブドメイン方式の実装方針（orgSlug.app.example.com）

本決定に基づき、組織ごとにサブドメインを分ける場合（例: `acme.app.example.com`）の実装方針を以下にまとめる。

---

### 7.1 ドメイン構成の想定

- ベースのマルチドメイン構成は ADR-001 を継続利用：
  - `www.example.com`  … マーケティング / サインイン
  - `app.example.com`  … メインアプリ
  - `admin.example.com` … 組織管理
  - `ops.example.com`   … 運用ツール
- これに加えて、メインアプリに対して orgSlug を左に付けたサブドメインを導入する：
  - `acme.app.example.com`
  - `contoso.app.example.com`
- orgSlug は DB 上の `organizations.slug` と 1:1 で対応させる。

---

### 7.2 インフラ（Vercel + DNS）側の作業

1. **Vercel プロジェクト設定**
   - 既存の `app.example.com` に加えて、同じプロジェクトに
     `*.app.example.com` を追加する。
   - これにより、任意の `{orgSlug}.app.example.com` が同一プロジェクトに到達する。

2. **DNS 設定（例）**
   - レジストラ / Cloudflare 等で `example.com` を管理している前提：
     - `app.example.com` → CNAME で Vercel 提示の値へ
     - `*.app.example.com` → CNAME で同じく Vercel 提示の値へ
   - あるいは `example.com` の NS を Vercel に向け、Vercel UI 上で
     `app.example.com` と `*.app.example.com` を登録する運用も可。

※この段階で **「ロジックだけ」ではなくインフラ変更が必須** になる点に注意。

---

### 7.3 アプリ側のロジック変更ポイント

1. **orgSlug の解決（apps/app の middleware）**
   - Host ヘッダから orgSlug を抽出する：

```typescript
// apps/app/middleware.ts（イメージ）
import { NextRequest, NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  const host = req.headers.get('host') ?? '';
  // 例: acme.app.example.com
  const parts = host.split('.');
  // [ 'acme', 'app', 'example', 'com' ] 想定
  let orgSlug: string | null = null;

  if (parts.length >= 3 && parts[1] === 'app') {
    orgSlug = parts[0]; // acme
  }

  // orgSlug が取れたらクエリやヘッダに乗せて Server Component 側に渡す
  if (orgSlug) {
    const url = req.nextUrl.clone();
    url.searchParams.set('__org', orgSlug);
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}
```

2. **getCurrentOrg() の拡張**
   - 従来：user_org_context だけを見て org を決定していた
   - 変更後：
     1. `__org` クエリ（またはヘッダ）から orgSlug を取得
     2. 存在する場合：`organizations.slug = orgSlug` で org_id 解決＋membership チェック
     3. ない場合：従来どおり user_org_context を fallback として利用（互換性維持）
   - これにより、画面側は `getCurrentOrg()` の呼び出しを変えずに挙動だけ差し替えられる。

3. **認可・RLS との関係**
   - RLS / 認可は引き続き DB上の org_id / role を信頼する。
   - orgSlug はあくまで「ルーティングキー」であり、
     最終的な可否判定は profiles / memberships → RLS で行う。
   - ADR-007 の「Cookie禁止・DB一元管理」は維持される。

---

### 7.4 テスト・移行上の注意点

- **影響範囲**：
  - middleware / getCurrentOrg / getCurrentRole など コンテキスト解決まわり
  - E2E テストの baseURL や `loginAsOrg(...)` helper
- **逆に言うと**：
  - 画面コンポーネントやビジネスロジックは極力ノータッチにする設計が望ましい。
- **段階的移行案（推奨）**：
  1. 本番・ローカルともに `*.app.example.com` / `*.app.local.test` を準備し、apps/app からの配信を確認する
  2. middleware / getCurrentOrg / getCurrentRole 等を上記のサブドメイン前提ロジックに切り替える
  3. E2Eテストで org サブドメイン間の挙動（acme.app / contoso.app など）をカバーする

---

## 関連ドキュメント

- [ADR-007: 組織コンテキストのDB管理（Cookie禁止）](../adr/ADR-007-org-context-in-database.md)
- [ADR-001: マルチドメイン構成](../adr/ADR-001-multi-domain-architecture.md)

## 作成日

2025-11-20
