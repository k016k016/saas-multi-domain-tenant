# Cookies & Sessions（Next.js 16）

## 目的
Cookieの扱いを Next.js 16 の仕様に合わせて統一する。

## 使い分けマトリクス
| 実行場所 | 使うAPI | 注意点 |
| --- | --- | --- |
| **middleware (Edge)** | `NextRequest/NextResponse` の `cookies` | `next/headers` は **使わない** |
| **Route Handler / Server Action (Node)** | `await cookies()` | ここで Supabase+RLS による本検証 |
| **RSC (Node)** | `await cookies()` | 軽読取りのみ。重いIOは Route/Action へ |

## サンプル（Server Action / Route Handler）
```ts
export async function createServerClient() {
  const cookieStore = await cookies() // ← async
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        get(name)   { return cookieStore.get(name)?.value },
        set(name, value, opts) { /* 必要なら実装 */ },
        remove(name, opts)     { /* 必要なら実装 */ }
      }
    }
  )
  return supabase
}
```

## サンプル（middleware）
```ts
import { NextRequest, NextResponse } from 'next/server'
export function middleware(req: NextRequest) {
  const orgId = req.cookies.get('org_id')?.value
  const role  = req.cookies.get('role')?.value
  if (!orgId || !role) return NextResponse.redirect('http://www.local.test:3001/login')
  return NextResponse.next()
}
```

## 禁止事項
- middleware で `next/headers::cookies()` を使う。
- `cookies()` を同期的に扱う（await を外す）。
- middleware から DB/Supabase を触る。
