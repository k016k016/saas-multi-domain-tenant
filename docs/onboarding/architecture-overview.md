# アーキテクチャ概要

このプロジェクトの設計判断の背景と、CLAUDE.mdルールが存在する理由を説明します。

---

## このプロジェクトは何か

**マルチテナントSaaSスターター** - 複数の顧客組織を1つの基盤で安全にホストするための土台。

### 特徴

- **責務分離**: 4つのドメイン（www/app/admin/ops）が独立
- **権限境界**: ロール階層（member ⊂ admin ⊂ owner、ops は別枠）を固定
- **マルチテナント**: org_id 単位のアクセス制御（RLS必須）
- **監査文化**: 重要操作を activity_logs に記録

### 何ではないか

- **完成品SaaS** - ビジネスロジック・課金・本番Authは未実装
- **チュートリアル** - 「全部appにまとめてシンプル」な設計ではない
- **柔軟な権限モデル** - ロール追加・RLS無効化は不可

---

## なぜこの設計か

### 1. ドメイン分離（www/app/admin/ops）

#### 設計判断

4つのドメインを**独立したNext.jsアプリケーション**として分離し、本番では別々にデプロイします。

```
apps/
├── www/       # マーケティング・認証
├── app/       # 日常業務（member/admin/owner）
├── admin/     # 組織運用（admin/owner のみ）
└── ops/       # 事業者側コンソール（ops のみ）
```

#### 理由

| 理由 | 説明 |
|------|------|
| **セキュリティ境界** | admin画面への不正アクセスをネットワークレベルで遮断 |
| **監査** | 各ドメインの変更履歴を独立して追跡 |
| **ロールバック分離** | admin画面の問題がapp画面に影響しない |
| **権限境界の明確化** | middlewareの責務が単純（app: 全員OK、admin: admin/ownerのみ） |

#### 拒否される提案

- 「全部1つのNext.jsにまとめてhostヘッダで振り分ける」
- 「apps/www/app/admin/... のようなネスト構造」
- 「memberにも見えて便利な管理画面」

**なぜ拒否されるか**: セキュリティ境界が曖昧になり、middleware・RLS・E2Eテストが複雑化します。コスト削減よりも安全性を優先します。

---

### 2. ロール階層の固定

#### 設計判断

ロールは4種類のみ。新しいロールを勝手に発明しない。

```
member ⊂ admin ⊂ owner
ops（別枠）
```

#### 理由

| 理由 | 説明 |
|------|------|
| **包含関係の明確化** | admin は member のすべての権限を持つ（上位互換） |
| **RLSの単純化** | ロールが増えるとRLSポリシーが爆発的に複雑化 |
| **E2Eテストの保守性** | 4種類なら全パターンをテスト可能 |

#### 各ロールの責務

| ロール | できること | できないこと |
|--------|-----------|-------------|
| **member** | 自分の業務データ、プロフィール編集 | ユーザー管理、組織設定変更 |
| **admin** | memberの全権限 + ユーザー管理（招待・無効化・ロール変更） | 支払い変更、組織凍結、owner譲渡 |
| **owner** | adminの全権限 + 組織設定変更（支払い・凍結・廃止・owner譲渡） | - |
| **ops** | 事業者側の横断操作（全組織閲覧・強制凍結） | 顧客データの直接変更 |

#### 拒否される提案

- 「managerロールを追加しよう」
- 「member にも組織設定を見せたい」
- 「admin と owner を統合して簡単にしよう」

**なぜ拒否されるか**: ロールが増えると、RLS・middleware・E2Eテストの組み合わせ爆発が起きます。

---

### 3. マルチテナント / org_id コンテキスト

#### 設計判断

- 1ユーザーは複数組織に所属できる
- ユーザーは「現在アクティブな組織（org_id）」を切り替えられる
- すべてのデータ取得は「いまの org_id」のコンテキストで行われる

```typescript
// 現在の組織を取得
const { orgId } = await getCurrentOrg()

// org_id でフィルタリング
const { data } = await supabase
  .from('projects')
  .select('*')
  .eq('org_id', orgId)  // 必須
```

#### 理由

| 理由 | 説明 |
|------|------|
| **データ分離** | 他組織のデータが見えないことをDB層で保証（RLS） |
| **クロステナント攻撃の防止** | org_id を改ざんしても RLS でブロックされる |
| **監査** | 組織切り替え操作を activity_logs に記録 |

#### 実装の詳細

**org_id の保持場所**: `user_org_context` テーブル（Cookie禁止、ADR-007参照）

```sql
CREATE TABLE user_org_context (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  current_org_id UUID REFERENCES organizations(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**なぜCookieではないか**:
- CookieにはSession情報のみ保存（Supabase標準、ADR-006参照）
- org_id をCookieに入れると改ざんリスク・同期問題が発生
- DBに保存することでRLSと整合性を保つ

#### 拒否される提案

- 「org_id をCookieに保存して高速化しよう」
- 「RLSをオフにして全件見えるようにしよう」
- 「とりあえず固定org_idで動かそう」

**なぜ拒否されるか**: セキュリティの根幹を崩す提案だからです。

---

### 4. Row-Level Security (RLS) 必須

#### 設計判断

すべてのテーブルでRLSを有効化し、org_id でスコープします。

```sql
-- 組織メンバーのみが自組織のプロジェクトを閲覧
CREATE POLICY "Users can view their org's projects"
  ON projects
  FOR SELECT
  USING (org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid()));
```

#### 理由

| 理由 | 説明 |
|------|------|
| **深層防御** | アプリ層のバグがあってもDB層で防御 |
| **クロステナント攻撃の防止** | SQLインジェクションでも他組織のデータが取得できない |
| **規制対応** | GDPR・SOC2などのコンプライアンス要件を満たす |

#### 拒否される提案

- 「RLSをオフにして開発を楽にしよう」
- 「SELECT文で `WHERE org_id = ?` を書けば十分」
- 「後でRLSを追加しよう」

**なぜ拒否されるか**: RLSなしでマルチテナントSaaSを作ると、データ漏洩リスクが極めて高くなります。

---

### 5. Server Action で redirect() 禁止

#### 設計判断

Server Actionは `{ success, data }` を返し、`redirect()` しません。

```typescript
// ❌ 禁止
export async function createProject(data: FormData) {
  // ... 処理
  redirect('/projects/123')  // NG
}

// ✅ 推奨
export async function createProject(data: FormData) {
  // ... 処理
  return { success: true, projectId: '123' }
}

// Client Component
const result = await createProject(formData)
if (result.success) {
  router.push(`/projects/${result.projectId}`)  // OK
}
```

#### 理由

| 理由 | 説明 |
|------|------|
| **マルチドメイン対応** | `redirect('/path')` は現在のドメイン内でしか動かない |
| **ドメイン間遷移** | app → admin への遷移が絶対URL（`https://admin.example.com`）で必要 |
| **テスタビリティ** | Server ActionがRedirectを返すとE2Eテストで追跡困難 |

詳細は [Server Actions Pattern](../patterns/server-actions.md) を参照。

#### 拒否される提案

- 「redirect() で楽にしよう」
- 「絶対URLで redirect すればいいのでは」

**なぜ拒否されるか**: 絶対URLでの `redirect()` は localhost に丸められるため、マルチドメイン環境で動作しません。

---

### 6. 監査ログ（activity_logs）必須

#### 設計判断

重要な操作は必ず `activity_logs` に記録します。

```typescript
await logActivity(orgId, userId, 'member.role_changed', {
  target_user_id: targetUserId,
  old_role: 'member',
  new_role: 'admin',
})
```

#### 記録対象

- 組織切り替え
- メンバー管理（招待・ロール変更・無効化）
- 組織設定変更（支払い・凍結・owner譲渡）
- OPS操作（強制凍結・組織作成）

#### 理由

| 理由 | 説明 |
|------|------|
| **監査** | 誰が、いつ、何をしたかを追跡 |
| **トラブルシューティング** | 問題発生時の原因特定 |
| **コンプライアンス** | GDPR・SOC2などの規制対応 |

詳細は [Activity Logs Guide](../operations/activity-logs.md) を参照。

#### 拒否される提案

- 「ログはあとでいい」
- 「console.log で十分」

**なぜ拒否されるか**: 監査ログなしでは、セキュリティインシデント発生時に原因特定ができません。

---

### 7. Edge Middleware の責務分離

#### 設計判断

middlewareは**軽量判定のみ**。DB/認可はサーバ側で再検証します（ADR-005参照）。

```typescript
// middleware.ts（Edge Runtime）
export async function middleware(request: NextRequest) {
  // 軽量判定のみ
  const session = await getSession()
  if (!session) {
    return NextResponse.redirect('/login')
  }

  return NextResponse.next()
}

// page.tsx（Node Runtime）
export default async function Page() {
  // サーバ側で再検証
  const { role } = await getCurrentRole()
  if (role !== 'admin' && role !== 'owner') {
    notFound()
  }

  // ...
}
```

#### 理由

| 理由 | 説明 |
|------|------|
| **Edge制約** | Edge Runtimeは Node.js API・重いDB処理が使えない |
| **深層防御** | middlewareをバイパスされてもサーバ側で防御 |
| **パフォーマンス** | middlewareは高速（セッション確認のみ） |

#### 拒否される提案

- 「middlewareでRLSチェックしよう」
- 「middlewareでorg_idを取得してCookieに保存しよう」

**なぜ拒否されるか**: Edge Runtimeの制約とパフォーマンス劣化を引き起こします。

---

### 8. owner不在の組織は禁止

#### 設計判断

すべての組織には必ず1人のownerが存在します。

#### 理由

| 理由 | 説明 |
|------|------|
| **責任者の明確化** | 組織設定変更・支払い管理の責任者が必須 |
| **ゴーストテナントの防止** | owner不在の組織が放置されることを防ぐ |
| **監査** | owner権限譲渡を activity_logs に記録 |

#### 実装

- 組織作成時に初期ownerを必ず指定
- owner削除は禁止（譲渡のみ可能）
- owner権限譲渡時は自動的に降格（owner → admin）

#### 拒否される提案

- 「ownerをオプションにしよう」
- 「owner削除を許可しよう」

**なぜ拒否されるか**: owner不在の組織が増えると、責任者不明の状態で課金・サポート対応が困難になります。

---

## CLAUDE.mdルールの背景

### なぜCLAUDE.mdが存在するか

AIアシスタント（Claude）に**間違った提案をさせない**ためです。

#### よくある間違った提案

| 提案 | なぜ拒否されるか |
|------|----------------|
| 「全部appにまとめてシンプルにしましょう」 | セキュリティ境界が崩れる |
| 「RLSをオフにして楽にしましょう」 | データ漏洩リスク |
| 「Server ActionでredirectすればOK」 | マルチドメインで動作しない |
| 「org_idをCookieに保存しよう」 | 改ざんリスク・同期問題 |

### CLAUDE_RUNTIME_MIN.md vs CLAUDE_RUNTIME_FULL.md

| ファイル | 用途 | タイミング |
|---------|------|----------|
| **MIN** | 短縮版ルール | 小さい修正（ページ1枚の変更など） |
| **FULL** | 詳細版ルール | 大きい変更（ルーティング・権限モデル・RLS） |

**運用ルール**:
- 小さい修正は MIN を渡してから依頼
- ルーティングや権限モデルに触る場合は FULL を渡してから依頼
- MIN/FULLに反する提案（例: ドメイン統合、RLSバイパス）は受け入れない

---

## ブランチ運用

### ブランチ戦略

```
feature/* → develop → main
```

| ブランチ | 用途 | デプロイ先 |
|---------|------|----------|
| `feature/*` | 機能開発 | ローカル |
| `develop` | 日常開発用 | Vercel Preview |
| `main` | 安定版 | Vercel Production |

### 禁止事項

- `main` に直接push/commit
- PreviewとProductionを1本のブランチにまとめる
- 「developは壊れててOK」という扱い

**理由**: developはPreview環境で他人に見せる想定なので、完全なゴミ状態にして良いわけではありません。

---

## まとめ

### このプロジェクトの価値

**分離・権限境界・マルチテナント・監査**が最初から揃っていること。

### 崩してはいけないライン

1. ドメイン分離（www/app/admin/ops）
2. ロール階層（member ⊂ admin ⊂ owner、ops 別枠）
3. org_id コンテキスト（RLS必須）
4. Server Action で redirect() 禁止
5. 監査ログ必須
6. owner不在禁止

これらを崩す提案は、セキュリティ・監査・保守性を犠牲にするため、拒否されます。

---

## 参考資料

- [README.md](../../README.md) - プロジェクト概要
- [ADR-005: Edge Middleware Separation](../adr/ADR-005-edge-middleware-separation.md)
- [ADR-006: Supabase Session-Only Authentication](../adr/ADR-006-supabase-session-only-authentication.md)
- [ADR-007: Org Context in Database](../adr/ADR-007-org-context-in-database.md)
- [Multi-Domain Pattern](../patterns/multi-domain.md)
- [Server Actions Pattern](../patterns/server-actions.md)
- [Activity Logs Guide](../operations/activity-logs.md)
