# ADR-007: 組織コンテキストのDB管理（Cookie禁止）

## 決定日
2025-10-31

## 決定
- **active org / role を Cookie に保存しない**
- **組織コンテキストは DB のみで管理**（`user_org_context` テーブルおよび `organizations` / `memberships`）
- **role は DB から毎リクエスト取得**（`profiles` テーブル）
- **組織切り替えは DB の UPDATE 操作**（Cookie 操作なし）
- **app ドメインにおける org の決定は「Host の orgSlug → DB 解決」を優先し、user_org_context はサブドメイン未指定時のデフォルト org として利用する**

## ステータス
承認・実装済み

## コンテキスト

### 問題点
以前の実装では、組織コンテキスト（active org / role）を Cookie に保存していた:
- `org_id` Cookie: 現在アクティブな組織ID
- `role` Cookie: ユーザーのロール（owner/admin/member）

この実装には以下の問題があった:
- **改ざん可能**: Cookie は署名がなければユーザー側で改ざんできる
- **同期問題**: DB で role が変更されても Cookie は古いまま残る
- **セキュリティリスク**: Cookie を信頼したアクセス制御は脆弱
- **保守コスト**: Cookie と DB の二重管理

### 検討した代替案
1. **Cookie に署名を追加** → 実装が複雑化、DB との同期問題は未解決
2. **JWT に org_id/role を埋め込む** → Supabase Session トークンは変更不可
3. **現在の実装（DB のみ）** → ✅ 採用

## 決定内容の詳細

### 1. DB スキーマ

#### user_org_context テーブル
```sql
create table if not exists user_org_context (
  user_id uuid primary key,
  org_id  uuid not null,
  updated_at timestamptz not null default now()
);

-- RLS: 本人のみ更新可能
create policy "Users can update their own context"
  on user_org_context for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
```

#### profiles テーブル（role 管理）
```sql
-- 既存の profiles テーブルで role を管理
-- org_id と user_id の組み合わせで一意
create unique index profiles_org_user_uniq on profiles(org_id, id);
```

### 2. 実装パターン（サブドメイン前提を含む）

#### 組織コンテキストの取得（getCurrentOrg）
```typescript
export async function getCurrentOrg(opts?: { orgSlug?: string }): Promise<OrgContext | null> {
  const supabase = await createServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) return null;

  // 1. Host などから渡された orgSlug があれば優先して解決
  if (opts?.orgSlug) {
    const { data: org } = await supabase
      .from('organizations')
      .select('id, name, slug')
      .eq('slug', opts.orgSlug)
      .single();

    if (!org) return null;

    // membership チェック（所属していない orgSlug は 404 / 403 相当扱い）
    const { data: membership } = await supabase
      .from('memberships')
      .select('org_id')
      .eq('org_id', org.id)
      .eq('user_id', session.user.id)
      .single();

    if (!membership) return null;

    return { orgId: org.id, orgName: org.name };
  }

  // 2. orgSlug がない場合は user_org_context をデフォルト org として利用
  const { data: context } = await supabase
    .from('user_org_context')
    .select('org_id')
    .eq('user_id', session.user.id)
    .single();

  if (!context) return null;

  // organizations テーブルから組織情報を取得
  const { data: org } = await supabase
    .from('organizations')
    .select('id, name')
    .eq('id', context.org_id)
    .single();

  return org ? { orgId: org.id, orgName: org.name } : null;
}
```

#### ロールの取得（getCurrentRole）
```typescript
export async function getCurrentRole(): Promise<RoleContext | null> {
  const orgContext = await getCurrentOrg();
  if (!orgContext) return null;

  const supabase = await createServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) return null;

  // profiles テーブルから role を取得
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .eq('org_id', orgContext.orgId)
    .single();

  return profile ? {
    role: profile.role,
    orgId: orgContext.orgId,
    orgName: orgContext.orgName,
  } : null;
}
```

#### 組織切り替え（Server Action）
```typescript
export async function switchOrganization(
  newOrgId: string
): Promise<ActionResult<void>> {
  const supabase = await createServerClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.user?.id) {
    return { success: false, error: 'Not authenticated' };
  }

  // user_org_context を UPDATE（Cookie 操作なし）
  const { error } = await supabase
    .from('user_org_context')
    .update({ org_id: newOrgId, updated_at: new Date().toISOString() })
    .eq('user_id', session.user.id);

  if (error) {
    return { success: false, error: error.message };
  }

  // 監査ログ記録
  await logActivity({
    orgId: newOrgId,
    userId: session.user.id,
    action: 'org_switch',
    resourceType: 'organization',
    resourceId: newOrgId,
  });

  return {
    success: true,
    nextUrl: '/', // クライアント側で遷移
  };
}
```

### 3. アクセスパターン

#### Server Component での認可チェック（apps/app, apps/admin 共通）
```typescript
// apps/admin/app/members/page.tsx
export default async function MembersPage() {
  const roleContext = await getCurrentRole();

  // owner のみアクセス可能
  if (!roleContext || roleContext.role !== 'owner') {
    notFound();
  }

  return <MembersContent />;
}
```

#### Server Action での認可チェック
```typescript
export async function deleteMember(memberId: string): Promise<ActionResult<void>> {
  const roleContext = await getCurrentRole();

  if (!roleContext || roleContext.role !== 'owner') {
    return { success: false, error: 'Unauthorized' };
  }

  // 実行...
}
```

## セキュリティ上の利点

### Before（旧実装）
```
Cookie: org_id=abc123; role=admin  ← 改ざん可能
↓
middleware / Server Component で Cookie を読み取り
↓
Cookie を信頼してアクセス制御  ← 危険
```

### After（新実装）
```
Supabase Session Cookie のみ（署名済み）
↓
Server Component で DB から org_id/role を取得
  - user_org_context テーブル（RLS 保護）
  - profiles テーブル（RLS 保護）
↓
最新の情報で認可チェック  ← 安全
↓
RLS で最終的なデータアクセス制御  ← 多層防御
```

## パフォーマンス考慮

### DB クエリ頻度
- **毎リクエスト**: `getCurrentOrg()` / `getCurrentRole()` を実行
- **クエリ数**: 通常 2-3 クエリ（session + user_org_context + profiles/organizations）

### 最適化戦略
1. **RLS の活用**: PostgreSQL レベルでアクセス制御
2. **インデックス**: `user_org_context(user_id)`, `profiles(org_id, id)` に Index
3. **Server Component のキャッシュ**: Next.js の自動キャッシュ（開発時は無効化推奨）

### ベンチマーク（参考）
- `getCurrentOrg()`: 約 10-20ms（Supabase hosted）
- `getCurrentRole()`: 約 15-30ms（2 クエリ）
- E2E テスト: 28 tests in 7.3s（組織コンテキスト取得を含む）

## 検証

### セキュリティ監査結果
```bash
✅ 1. org_id/role Cookie書き込み: なし
✅ 2. 旧cookies.ts参照: なし
✅ 7. DB解決関数: getCurrentOrg/getCurrentRole 実装済み
```

### E2E テスト結果
```
28 passed (7.3s)
- 組織切り替えテスト: 正常動作
- 境界テスト（boundary）: 404 正しく返される
- RLS テスト: 組織間データ漏洩なし
```

## 移行ガイド

### 旧コードからの移行

#### ❌ 旧実装（削除）
```typescript
import { setSharedCookie, getSharedCookie } from '@repo/config/src/cookies';

// Cookie に保存
setSharedCookie('org_id', orgId);
setSharedCookie('role', role);

// Cookie から取得
const orgId = getSharedCookie('org_id');
const role = getSharedCookie('role');
```

#### ✅ 新実装（推奨）
```typescript
import { getCurrentOrg, getCurrentRole } from '@repo/config';

// DB から取得
const orgContext = await getCurrentOrg();
const roleContext = await getCurrentRole();

// 認可チェック
if (!roleContext || roleContext.role !== 'owner') {
  notFound();
}
```

## 今後の展開

### 推奨される開発パターン
1. **認証が必要なページ**: 必ず `getCurrentOrg()` を呼び出す
2. **認可が必要なページ**: `getCurrentRole()` で role をチェック
3. **組織切り替え**: `switchOrganization()` Server Action を使用
4. **監査ログ**: 重要な操作は `logActivity()` で記録

### 禁止事項（ESLint で自動検出）
- ❌ `org_id` / `role` を Cookie に保存
- ❌ `@repo/config/src/cookies` のインポート

## 関連 ADR
- [ADR-006: Supabase Session Cookie 専用認証への移行](./ADR-006-supabase-session-only-authentication.md)
- [ADR-005: Edge Middleware と Node サーバ処理の分離](./ADR-005-edge-middleware-separation.md)

## 参考資料
- [認証・認可パターン](../patterns/authentication-authorization.md)
- [Cookies & Sessions パターン](../patterns/cookies-and-sessions.md)
- [セキュリティ監査チェックリスト](../checklists/security-audit.md)
- working-log: `working-log/2025-10-31.md` - 実装の詳細な記録

## 補足: ADR-006 との関係

### 決定の分離理由
- **ADR-006**: 認証メカニズム（Supabase Session Cookie のみを使用）
- **ADR-007**: 認可情報の管理（org_id/role を DB で管理）

この2つは独立した決定であり、それぞれ異なる進化パスを持つ:
- ADR-006: 将来的に他の認証プロバイダー（Auth0, Clerk など）に変更可能
- ADR-007: 組織コンテキストの管理方法（将来的に Redis キャッシュなど追加可能）
