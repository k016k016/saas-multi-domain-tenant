import { NextRequest, NextResponse } from 'next/server';

type DomainType = 'www' | 'app' | 'admin' | 'ops';

/**
 * Server Action/RSCリクエストかどうかを判定
 * これらのリクエストは無条件で素通しさせる必要がある
 */
function isServerActionOrRSC(request: NextRequest): boolean {
  const headers = request.headers;

  // Next.js Server Actionsのヘッダー
  if (headers.get('next-action')) {
    return true;
  }

  // RSC (React Server Components) リクエスト
  if (headers.get('rsc')) {
    return true;
  }

  // Prefetchリクエスト
  if (headers.get('next-router-prefetch')) {
    return true;
  }

  return false;
}

/**
 * ホスト名からドメインタイプを判定
 */
function getDomainType(host: string | null): DomainType {
  if (!host) {
    return 'www'; // デフォルト
  }

  // サブドメインを抽出
  if (host.startsWith('app.')) {
    return 'app';
  }
  if (host.startsWith('admin.')) {
    return 'admin';
  }
  if (host.startsWith('ops.')) {
    return 'ops';
  }

  // www または ルートドメイン
  return 'www';
}

/**
 * OPSドメインのIP制限チェック（将来実装）
 */
function isAllowedIP(ip: string | undefined): boolean {
  // TODO: 本番環境では実際のIP制限を実装
  // 現時点では全て許可
  return true;
}

export async function middleware(request: NextRequest) {
  // 1. Server Action/RSCリクエストは無条件で素通し
  // IMPORTANT: これを最優先で処理すること
  if (isServerActionOrRSC(request)) {
    return NextResponse.next();
  }

  // 2. 静的ファイル（画像、フォントなど）は素通し
  const pathname = request.nextUrl.pathname;
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/static/') ||
    pathname.includes('.') // 拡張子を持つファイル
  ) {
    return NextResponse.next();
  }

  // 3. ホスト名からドメインタイプを判定
  const host = request.headers.get('host');
  const domainType = getDomainType(host);

  // 4. OPSドメインのIP制限
  if (domainType === 'ops') {
    const ip = request.ip;
    if (!isAllowedIP(ip)) {
      return new Response('Forbidden: IP not allowed', { status: 403 });
    }
  }

  // 5. 適切なドメイン別ディレクトリにリライト
  // 既にドメイン別ディレクトリ配下にいる場合はリライトしない
  if (pathname.startsWith(`/${domainType}`)) {
    return NextResponse.next();
  }

  // ドメイン別ディレクトリへのリライト
  const rewriteUrl = new URL(`/${domainType}${pathname}`, request.url);

  console.log(`[Middleware] Rewriting: ${pathname} -> /${domainType}${pathname} (host: ${host})`);

  return NextResponse.rewrite(rewriteUrl);
}

// Middlewareの適用パス設定
export const config = {
  matcher: [
    /*
     * 以下を除く全てのパスにマッチ:
     * - api (APIルート)
     * - _next/static (静的ファイル)
     * - _next/image (画像最適化ファイル)
     * - favicon.ico (ファビコン)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
