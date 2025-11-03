# Edge Middleware パターン

## やってよい
- ドメイン判定（文字列処理）
- `NextRequest/NextResponse` 経由の Cookie 読取/設定
- 粗い遮断（未ログイン・role=member の admin 侵入拒否）

## やってはいけない
- DB/Supabase クライアント生成やクエリ
- `next/headers` の `cookies()` フック
- `@repo/db` の import

## ⚠️ 廃止されたパターン

以下のサンプルコードは**廃止されました**。ADR-006/007により、org_idとroleをCookieに保存することは禁止されています。

<details>
<summary>廃止されたサンプルコード（参考用）</summary>

```ts
import { NextRequest, NextResponse } from 'next/server'
import { DOMAINS } from '@repo/config-edge'

export function middleware(req: NextRequest) {
  const url = new URL(req.url)
  const org = req.cookies.get('org_id')?.value // ❌ 廃止: org_idはCookieに保存しない
  const role = req.cookies.get('role')?.value // ❌ 廃止: roleはCookieに保存しない

  if (!org || !role) {
    return NextResponse.redirect(`${DOMAINS.www}/login?next=${encodeURIComponent(url.href)}`)
  }
  if (url.hostname.startsWith('admin.') && role === 'member') {
    return NextResponse.redirect(`${DOMAINS.app}/dashboard`)
  }
  return NextResponse.next()
}
```

</details>

**現在の方針:**
- org_id/roleは**Cookieに保存せず、DBから取得する**（ADR-006/007参照）
- middlewareではSupabase Session Cookieの存在のみを確認
- 詳細な認可チェックは**Route Handler/Server Action/Page**で行う

サーバ側（本検証）
- Route Handler / Server Action / Page で runtime='nodejs' を明示し、Supabase + RLS で再検証する。


