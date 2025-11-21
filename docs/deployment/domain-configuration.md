# ドメイン設定ガイド

このプロジェクトは4つのサブドメインを使用し、Cookie共有によるSSOを実現します。

---

## ドメイン構成

### 本番環境

| サブドメイン | 用途 | アクセス権限 |
|------------|------|------------|
| `www.yourdomain.com` | マーケティング・認証 | 全員（未認証含む） |
| `app.yourdomain.com` | メインアプリケーション | member/admin/owner |
| `admin.yourdomain.com` | 管理ダッシュボード | admin/owner のみ |
| `ops.yourdomain.com` | 運用コンソール | ops のみ |

### 組織サブドメイン（将来対応予定）

- `<org-slug>.app.yourdomain.com` - 組織専用アプリURL
- 例: `acme.app.yourdomain.com`, `contoso.app.yourdomain.com`

---

## DNS設定

### 1. Vercelへのドメイン追加

各Vercelプロジェクトで **Settings → Domains** から以下を追加：

**WWWプロジェクト**:
```
www.yourdomain.com
```

**APPプロジェクト**:
```
app.yourdomain.com
*.app.yourdomain.com  (将来の組織サブドメイン対応)
```

**ADMINプロジェクト**:
```
admin.yourdomain.com
```

**OPSプロジェクト**:
```
ops.yourdomain.com
```

### 2. DNSプロバイダーでの設定

ドメイン管理サービス（Cloudflare、Route53、Namecheapなど）で以下のレコードを追加：

#### Aレコード（IPv4）

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | `www` | `76.76.21.21` | 3600 |
| A | `app` | `76.76.21.21` | 3600 |
| A | `admin` | `76.76.21.21` | 3600 |
| A | `ops` | `76.76.21.21` | 3600 |

**注意**: `76.76.21.21` はVercelのIPアドレス例です。実際の値は **Vercel → Settings → Domains** で確認してください。

#### AAAAレコード（IPv6）

| Type | Name | Value | TTL |
|------|------|-------|-----|
| AAAA | `www` | `2606:4700:4700::1111` | 3600 |
| AAAA | `app` | `2606:4700:4700::1111` | 3600 |
| AAAA | `admin` | `2606:4700:4700::1111` | 3600 |
| AAAA | `ops` | `2606:4700:4700::1111` | 3600 |

#### CNAMEレコード（推奨）

DNSプロバイダーがCNAME flattening（CNAME at apex）をサポートしている場合、以下の方が推奨されます：

| Type | Name | Value | TTL |
|------|------|-------|-----|
| CNAME | `www` | `cname.vercel-dns.com` | 3600 |
| CNAME | `app` | `cname.vercel-dns.com` | 3600 |
| CNAME | `admin` | `cname.vercel-dns.com` | 3600 |
| CNAME | `ops` | `cname.vercel-dns.com` | 3600 |

#### ワイルドカードレコード（組織サブドメイン対応）

| Type | Name | Value | TTL |
|------|------|-------|-----|
| CNAME | `*.app` | `cname.vercel-dns.com` | 3600 |

**説明**: `acme.app.yourdomain.com`, `contoso.app.yourdomain.com` などの組織専用URLに対応します。

---

## Cookie共有設定

### Cookie Domain

全4つのVercelプロジェクトで以下の環境変数を設定：

```bash
NEXT_PUBLIC_COOKIE_DOMAIN=.yourdomain.com
```

**重要**: ドット（`.`）で始めることで、すべてのサブドメイン（`www`, `app`, `admin`, `ops`）でCookieが共有されます。

### Cookieオプション

認証Cookieは以下の設定で発行されます（実装は `packages/config/src/auth.ts` を参照）：

```typescript
{
  name: 'sb-access-token',
  domain: process.env.NEXT_PUBLIC_COOKIE_DOMAIN, // .yourdomain.com
  path: '/',
  httpOnly: true,
  secure: true,  // 本番環境では必須（HTTPS）
  sameSite: 'lax',
  maxAge: 3600 * 24 * 7  // 7日間
}
```

**セキュリティノート**:
- `httpOnly: true` - JavaScriptからのアクセスを防止（XSS対策）
- `secure: true` - HTTPS接続でのみ送信（本番必須）
- `sameSite: 'lax'` - CSRF対策

---

## SSL/TLS証明書

Vercelは自動的にLet's Encryptを使用してSSL証明書を発行します。

### 自動発行の流れ

1. Vercelにカスタムドメインを追加
2. DNSレコードを設定
3. Vercelが自動的にSSL証明書を発行（通常1〜5分）
4. HTTPSが有効になる

### 確認方法

各ドメインで以下を確認：
```bash
curl -I https://www.yourdomain.com
curl -I https://app.yourdomain.com
curl -I https://admin.yourdomain.com
curl -I https://ops.yourdomain.com
```

**期待される結果**:
```
HTTP/2 200
x-vercel-id: ...
strict-transport-security: max-age=31536000
```

---

## ドメイン間遷移の実装

### 認証後のリダイレクト

ユーザーの権限に応じて適切なドメインにリダイレクトします（実装例）：

```typescript
// www/app/login/actions.ts
export async function login(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { success: false, error: error.message }
  }

  // ユーザーのロールを取得
  const role = await getCurrentRole()

  // ロールに応じたドメインを決定
  let redirectUrl: string
  if (role === 'ops') {
    redirectUrl = process.env.NEXT_PUBLIC_OPS_URL!
  } else if (role === 'admin' || role === 'owner') {
    redirectUrl = process.env.NEXT_PUBLIC_ADMIN_URL!
  } else {
    redirectUrl = process.env.NEXT_PUBLIC_APP_URL!
  }

  return { success: true, redirectUrl }
}
```

クライアント側での遷移：

```typescript
// www/app/login/page.tsx
const result = await login(email, password)

if (result.success && result.redirectUrl) {
  // 絶対URLで遷移（ドメインをまたぐ）
  window.location.href = result.redirectUrl
}
```

### 組織切り替え時のリダイレクト

組織を切り替えた後、組織専用サブドメインにリダイレクト（将来実装）：

```typescript
const org = await getOrganization(orgId)
const subdomain = org.slug // "acme", "contoso" など

// 組織専用URLにリダイレクト
window.location.href = `https://${subdomain}.app.yourdomain.com`
```

---

## アクセス制御

### Middlewareによる制御

各ドメインのmiddlewareで権限チェックを実施（例: `apps/admin/middleware.ts`）：

```typescript
export async function middleware(request: NextRequest) {
  // ログインチェック
  const session = await getSession()
  if (!session) {
    return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_WWW_URL))
  }

  // ロールチェック（admin/owner以外は403）
  const role = await getCurrentRole()
  if (role !== 'admin' && role !== 'owner') {
    return new Response('Forbidden', { status: 403 })
  }

  return NextResponse.next()
}
```

**重要**: 各ドメインのmiddlewareは独立して動作します。Cookie共有 ≠ 入場許可。

---

## 開発環境との差異

| 項目 | 開発環境 | 本番環境 |
|------|---------|---------|
| ドメイン | `.local.test` | `.yourdomain.com` |
| プロトコル | HTTP | HTTPS |
| Cookie Secure | `false` | `true` |
| ポート | 3001〜3004 | 443（標準HTTPS） |

### ローカル開発でのドメイン設定

`/etc/hosts`（macOS/Linux）または `C:\Windows\System32\drivers\etc\hosts`（Windows）:

```
127.0.0.1 www.local.test
127.0.0.1 app.local.test
127.0.0.1 admin.local.test
127.0.0.1 ops.local.test
127.0.0.1 acme.app.local.test
127.0.0.1 contoso.app.local.test
```

`.env.local`:
```bash
NEXT_PUBLIC_COOKIE_DOMAIN=.local.test
NEXT_PUBLIC_WWW_URL=http://www.local.test:3001
NEXT_PUBLIC_APP_URL=http://app.local.test:3002
NEXT_PUBLIC_ADMIN_URL=http://admin.local.test:3003
NEXT_PUBLIC_OPS_URL=http://ops.local.test:3004
```

---

## チェックリスト

ドメイン設定後、以下を確認してください：

- [ ] 全サブドメイン（www/app/admin/ops）がHTTPSでアクセス可能
- [ ] SSL証明書が有効（ブラウザで鍵マークが表示される）
- [ ] `NEXT_PUBLIC_COOKIE_DOMAIN` が `.yourdomain.com` に設定されている
- [ ] 各Vercelプロジェクトにカスタムドメインが追加されている
- [ ] DNSレコード（A/AAAA/CNAME）が正しく設定されている
- [ ] Cookie共有が動作する（wwwでログイン → app/adminでもログイン状態が維持される）
- [ ] 権限制御が正しく動作する（memberがadminにアクセス → 403）

---

## トラブルシューティング

### ドメインにアクセスできない

**原因**: DNS設定が反映されていない

**解決策**:
1. DNSレコードが正しいか確認
2. DNS伝播を待つ（最大48時間、通常は数分〜1時間）
3. `dig www.yourdomain.com` でDNS解決を確認

### SSL証明書エラー

**原因**: Vercelがドメインを検証できていない

**解決策**:
1. Vercel → Settings → Domains で証明書ステータスを確認
2. DNSレコードが正しいか再確認
3. 「Refresh Certificate」ボタンをクリック

### Cookie共有ができない

**原因1**: `NEXT_PUBLIC_COOKIE_DOMAIN` が間違っている

**解決策**: `.yourdomain.com` のようにドット（`.`）で始まることを確認

**原因2**: `secure: true` だがHTTPでアクセスしている

**解決策**: 本番環境では必ずHTTPSを使用

### ドメイン遷移後にログアウトされる

**原因**: Cookie共有が正しく設定されていない

**解決策**:
1. ブラウザの開発者ツール → Application → Cookies で確認
2. `Domain` が `.yourdomain.com` になっているか確認
3. 全Vercelプロジェクトで `NEXT_PUBLIC_COOKIE_DOMAIN` が同じ値か確認

---

## 参考資料

- [Vercel Custom Domains](https://vercel.com/docs/concepts/projects/custom-domains)
- [Cookie設定パターン](../patterns/cookies-and-sessions.md)
- [マルチドメインパターン](../patterns/multi-domain.md)
