#!/usr/bin/env node
// Creates (or finds) the admin account from ADMIN_EMAIL / ADMIN_PASSWORD and grants the admin role.
// Run locally with the server-only SUPABASE_SERVICE_ROLE_KEY in .env.local: npm run admin:bootstrap
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
for (const name of ['.env', '.env.local']) {
  const file = path.join(root, name)
  if (!fs.existsSync(file)) continue
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase()
const password = process.env.ADMIN_PASSWORD || ''
const memberId = process.env.ADMIN_MEMBER_ID || '1000000000'

if (!url || !serviceKey || !email || password.length < 8) {
  console.error('[bootstrap-admin] Need SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_EMAIL and ADMIN_PASSWORD (8+ chars).')
  process.exit(1)
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

let userId
const { data: created, error: createError } = await admin.auth.admin.createUser({
  email, password, email_confirm: true,
  user_metadata: { first_name: 'Nexus', last_name: 'Admin', member_id: memberId },
})
if (created?.user) {
  userId = created.user.id
  console.log('[bootstrap-admin] Admin account created.')
} else {
  for (let page = 1; !userId; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) { console.error('[bootstrap-admin]', createError?.message || error.message); process.exit(2) }
    userId = data.users.find((u) => u.email?.toLowerCase() === email)?.id
    if (data.users.length < 200) break
  }
  if (!userId) { console.error('[bootstrap-admin]', createError?.message || 'Admin user not found.'); process.exit(2) }
  console.log('[bootstrap-admin] Admin account already exists.')
}

const { error: roleError } = await admin.from('user_roles').upsert({ user_id: userId, role: 'admin' }, { onConflict: 'user_id,role' })
if (roleError) { console.error('[bootstrap-admin] Could not grant admin role:', roleError.message); process.exit(3) }
console.log('[bootstrap-admin] Admin role granted.')
