# ADR-004: メンバー数制限

**ステータス**: 提案（未実装）

**日付**: 2025-10-28

---

## 背景

組織の契約プランによってメンバー数に上限を設ける必要がある。
- 無料プランは少人数（例: 5人）
- 有料プランは段階的に上限が増える
- またはユーザー数課金の場合、上限を超えると追加料金

現在は未実装だが、将来のSupabase統合・課金統合時に必要となる。

---

## 決定事項

### 1. プラン別のメンバー数上限

```typescript
const PLANS = {
  free: { maxMembers: 5 },
  basic: { maxMembers: 20 },
  business: { maxMembers: 100 },
  enterprise: { maxMembers: Infinity },  // 無制限
};
```

### 2. チェックポイント

メンバー数上限チェックは以下のタイミングで実行する：

#### `/admin/members`のユーザー招待時
```typescript
export async function inviteUser(email: string, role: Role): Promise<ActionResult> {
  // 現在のメンバー数を取得
  const currentMemberCount = await getMemberCount(orgId);
  const org = await getOrganization(orgId);
  const plan = PLANS[org.plan];

  // 上限チェック
  if (currentMemberCount >= plan.maxMembers) {
    return {
      success: false,
      error: `メンバー数が上限（${plan.maxMembers}人）に達しています。プランをアップグレードしてください。`,
      nextUrl: '/admin/org-settings?tab=billing'
    };
  }

  // 招待処理...
}
```

### 3. データベーススキーマ

#### organizationsテーブルに追加
```sql
ALTER TABLE organizations
ADD COLUMN plan TEXT NOT NULL DEFAULT 'free';
-- 'free' | 'basic' | 'business' | 'enterprise'
```

### 4. UIでの表示

#### `/admin/members`ページ
```typescript
const org = await getOrganization(orgId);
const currentCount = await getMemberCount(orgId);
const plan = PLANS[org.plan];

// ヘッダーに表示
<div>
  メンバー: {currentCount} / {plan.maxMembers === Infinity ? '無制限' : plan.maxMembers}
</div>

// 上限に達している場合は招待ボタンを無効化
<button disabled={currentCount >= plan.maxMembers}>
  ユーザーを招待
</button>
```

---

## 代替案

### 案1: ソフトリミット（警告のみ）
- 上限を超えても招待は可能
- 警告メッセージのみ表示
- 課金は後日請求

**却下理由**: 無料プランの濫用を防げない

### 案2: ハードリミット（現在の提案）
- 上限を超えたら招待不可
- プランアップグレードを促す

**採用理由**: シンプルで分かりやすい

---

## 影響範囲

### 実装が必要なファイル
- [ ] `infra/supabase/schema.sql` - organizationsテーブルにplan追加
- [ ] `packages/config/src/plans.ts` - プラン定義（新規）
- [ ] `apps/www/app/admin/members/actions.ts` - 招待時のチェック追加
- [ ] `apps/www/app/admin/members/page.tsx` - メンバー数表示追加
- [ ] `apps/www/app/admin/org-settings/page.tsx` - プラン変更UI（将来）

### 依存関係
- Supabase統合が完了していること
- 課金システム（Stripe等）が統合されていること

---

## 実装タイミング

- **Phase 1**: Supabase統合後
  - organizationsテーブルにplan追加
  - `/admin/members`で現在のメンバー数を表示

- **Phase 2**: 課金統合時
  - プラン別の上限チェック実装
  - プランアップグレードUI実装

---

## 参考資料

### 仕様書
- [roles-and-access.md](../spec/roles-and-access.md) - ロール定義

### 関連ADR
- [ADR-001: マルチドメインアーキテクチャ](./001-multi-domain-architecture.md)

---

## 備考

- この仕様は提案段階であり、実装時に変更される可能性がある
- プラン名や上限値は例であり、ビジネス要件に応じて調整する
