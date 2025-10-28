# マルチドメイン環境パターン

このプロジェクトは4つのドメイン（WWW, APP, ADMIN, OPS）を使用しています。

---

## 📌 ドメイン構成

| ドメイン | ローカル | 本番 | 用途 | ルートグループ |
|---------|---------|------|------|--------------|
| WWW | `www.local.test:3000` | `www.domain.com` | マーケティング、認証 | `(www)` |
| APP | `app.local.test:3000` | `app.domain.com` | メインアプリ | `(app)` |
| ADMIN | `admin.local.test:3000` | `admin.domain.com` | 管理ダッシュボード | `(admin)` |
| OPS | `ops.local.test:3000` | `ops.domain.com` | 運用ツール（IP制限） | `(ops)` |

---

## 🔑 Cookie共有の設定

### ドメイン設定

**環境変数** (`.env.local`):
```bash
NEXT_PUBLIC_COOKIE_DOMAIN=.local.test  # ローカル
# NEXT_PUBLIC_COOKIE_DOMAIN=.domain.com  # 本番
```

**Cookieオプション**:
```typescript
cookies().set({
  name: 'session',
  value: token,
  domain: process.env.NEXT_PUBLIC_COOKIE_DOMAIN, // サブドメイン間で共有
  path: '/',
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
})
```

### /etc/hostsの設定（ローカル開発）

```bash
127.0.0.1 local.test
127.0.0.1 www.local.test
127.0.0.1 app.local.test
127.0.0.1 admin.local.test
127.0.0.1 ops.local.test
```

**重要**: `localhost`ではサブドメイン間のCookie共有ができないため、`.local.test`を使用します。

---

## 🚀 Server Actionでの遷移

### ❌ 避けるべきパターン

```typescript
export async function createItem() {
  // ... 処理

  // ❌ 絶対URLは localhost に丸められる
  redirect('http://app.local.test:3000/items/123')
}
```

### ✅ 推奨パターン

```typescript
// Server Action
export async function createItem(data: FormData) {
  // ... 処理

  return { success: true, itemId: item.id }
}

// Client Component
const result = await createItem(formData)
if (result.success) {
  // ✅ 相対URLで現在のドメインを維持
  router.push(`/items/${result.itemId}`)
}
```

**詳細**: [Server Actionsパターン](./server-actions.md#1-server-actionではredirectを使わないマルチドメイン環境)

---

## 🔀 ドメイン間遷移

### 認証後のリダイレクト

```typescript
import { getRedirectUrlForUser } from '@/lib/auth/redirect'

// ユーザーの権限に応じたドメインを判定
const redirectUrl = getRedirectUrlForUser(user)

// クライアント側で遷移（絶対URL）
window.location.href = redirectUrl
```

**判定ロジック**:
- OPS権限 → OPSドメイン
- 管理者権限（owner/admin） → ADMINドメイン
- 一般メンバー → APPドメイン
- 組織未所属 → WWWのオンボーディング

---

## 🛡️ Middlewareの役割

### ドメイン検出とリライト

```typescript
export async function middleware(request: NextRequest) {
  // 1. Server Action/RSCリクエストは無条件で素通し
  if (isServerActionOrRSC(request)) {
    return NextResponse.next()
  }

  // 2. ホスト名からドメインタイプを判定
  const domainType = getDomainType(request.headers.get('host'))

  // 3. OPSドメインのIP制限
  if (domainType === 'ops') {
    if (!isAllowedIP(request.ip)) {
      return new Response('Forbidden', { status: 403 })
    }
  }

  // 4. 適切なルートグループにリライト
  return NextResponse.rewrite(new URL(`/${domainType}${pathname}`, request.url))
}
```

**重要**: Server Action/RSCリクエストは**最優先で素通し**させること。

**実装**: `src/middleware.ts`

---

## 🔍 チェックリスト

マルチドメイン機能実装時に確認すべき項目：

- [ ] Cookie共有のドメイン設定が正しい（`.local.test` または `.domain.com`）
- [ ] Server Actionでは`redirect()`を使わず値を返している
- [ ] ドメイン間遷移は絶対URL（`window.location.href`）を使用
- [ ] `/etc/hosts`にサブドメインを登録している（ローカル開発）
- [ ] Middlewareで適切なルートグループにリライトしている
- [ ] E2Eテストでドメインが維持されることを確認している

---

## 📚 関連資料

### 仕様書
- [マルチドメインセットアップ](../../docs/specifications/MULTI_DOMAIN_SETUP.md)
- [認証フロー仕様](../../docs/specifications/AUTH_FLOW_SPECIFICATION.md)

### パターン
- [Server Actionsパターン](./server-actions.md)

### ADR
- [ADR-001: マルチドメインアーキテクチャ](../decisions/001-multi-domain-architecture.md)

---

このパターンを守ることで、**安定したマルチドメイン環境**を実現できます。
