# Edge Middleware パターン

## やってよい
- ドメイン判定（文字列処理）
- `NextRequest/NextResponse` 経由の Cookie 読取/設定
- 粗い遮断（未ログイン・role=member の admin 侵入拒否）

## やってはいけない
- DB/Supabase クライアント生成やクエリ
- `next/headers` の `cookies()` フック
- `@repo/db` の import

## サンプル
```ts
import { NextRequest, NextResponse } from 'next/server'
import { DOMAINS } from '@repo/config-edge'

export function middleware(req: NextRequest) {
  const url = new URL(req.url)
  const org = req.cookies.get('org_id')?.value
  const role = req.cookies.get('role')?.value // 'member'|'admin'|'owner'

  if (!org || !role) {
    return NextResponse.redirect(`${DOMAINS.www}/login?next=${encodeURIComponent(url.href)}`)
  }
  if (url.hostname.startsWith('admin.') && role === 'member') {
    return NextResponse.redirect(`${DOMAINS.app}/dashboard`)
  }
  return NextResponse.next()
}
```

サーバ側（本検証）
- Route Handler / Server Action / Page で runtime='nodejs' を明示し、Supabase + RLS で再検証する。


