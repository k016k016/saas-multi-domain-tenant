import 'dotenv/config'
import fetch from 'cross-fetch'
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceRole) {
  console.error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が未設定')
  process.exit(1)
}

const admin = createClient(url, serviceRole, { auth: { persistSession: false } })

const PASSWORD = process.env.E2E_TEST_PASSWORD || 'Test1234!aB!2025' // 強め（ポリシー対策）
const REDIRECT = 'http://www.local.test:3001/auth/callback'
const USERS = [
  { email: 'member1@example.com' },
  { email: 'admin1@example.com' },
  { email: 'owner1@example.com' },
]

async function listByEmail(email) {
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (error) throw error
  return data?.users?.find(u => (u.email || '').toLowerCase() === email.toLowerCase()) || null
}

async function ensurePasswordAndConfirm(userId) {
  const { error } = await admin.auth.admin.updateUserById(userId, {
    password: PASSWORD,
    email_confirm: true,
  })
  if (error) throw error
}

async function tryCreateDirect(email) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  })
  if (error) throw error
  return data.user
}

async function signupViaActionLink(email) {
  // サインアップ用リンクを発行（メール送信なし）
  const { data, error } = await admin.auth.admin.generateLink({
    type: 'signup',
    email,
    password: PASSWORD,
    options: { redirectTo: REDIRECT },
  })
  if (error) throw error

  const link = data?.action_link
  if (!link) throw new Error('action_link not returned')

  // サーバ側からリンクを踏む（リダイレクトは追わない）。これでユーザが作成される
  const res = await fetch(link, { redirect: 'manual' })
  if (![200, 302, 303].includes(res.status)) {
    throw new Error(`action_link request failed: ${res.status}`)
  }

  // 出現待ち（最大30秒）
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    const u = await listByEmail(email)
    if (u) return u
    await new Promise(r => setTimeout(r, 500))
  }
  throw new Error('user did not appear after action_link')
}

async function ensureOne(email) {
  // 既存なら password & confirm を揃えるだけ
  const existing = await listByEmail(email)
  if (existing) {
    await ensurePasswordAndConfirm(existing.id)
    return existing
  }

  // 1) まずは通常の createUser（速い）
  try {
    const u = await tryCreateDirect(email)
    return u
  } catch (e) {
    // "Database error creating new user" 等を想定してフォールバック
    console.warn(`createUser failed for ${email}: ${e?.message || e}`)
  }

  // 2) フォールバック：サインアップリンクを発行→踏む→出現後に仕上げ
  const u2 = await signupViaActionLink(email)
  await ensurePasswordAndConfirm(u2.id)
  return u2
}

async function main() {
  console.log('Ensuring test users...')
  for (const u of USERS) {
    const res = await ensureOne(u.email)
    console.log('OK:', u.email, res.id)
  }
  console.log('All ensured. Password:', PASSWORD)
}
main().catch(e => { console.error(e); process.exit(1) })
