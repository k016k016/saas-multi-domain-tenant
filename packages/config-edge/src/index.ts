export type Domain = 'www'|'app'|'admin'|'ops'

export function getDomainFromHost(host: string): Domain {
  const h = host.toLowerCase()
  if (h.startsWith('www.')) return 'www'
  if (h.startsWith('app.')) return 'app'
  if (h.startsWith('admin.')) return 'admin'
  if (h.startsWith('ops.')) return 'ops'
  return 'www'
}

/** クライアント/Edge両用の公開URL（build時に埋め込み） */
export const DOMAINS = {
  www:   process.env.NEXT_PUBLIC_WWW_URL   ?? 'http://www.local.test:3001',
  app:   process.env.NEXT_PUBLIC_APP_URL   ?? 'http://app.local.test:3002',
  admin: process.env.NEXT_PUBLIC_ADMIN_URL ?? 'http://admin.local.test:3003',
  ops:   process.env.NEXT_PUBLIC_OPS_URL   ?? 'http://ops.local.test:3004'
} as const
