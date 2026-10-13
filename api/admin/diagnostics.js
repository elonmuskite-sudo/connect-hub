import { createClient } from '@supabase/supabase-js'

// Admin-only: reports which Vercel server settings are present. Never returns values.
const KEYS = [
  { service: 'Supabase', key: 'SUPABASE_URL' },
  { service: 'Supabase', key: 'SUPABASE_ANON_KEY' },
  { service: 'Supabase', key: 'SUPABASE_SERVICE_ROLE_KEY' },
  { service: 'Resend', key: 'RESEND_API_KEY' },
  { service: 'Resend', key: 'RESEND_FROM' },
]

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    return res.status(503).json({ error: 'Vercel is missing its Supabase server settings.', checks: KEYS.map((c) => ({ ...c, configured: Boolean(process.env[c.key]?.trim()) })) })
  }

  const token = String(req.headers.authorization || '').replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Sign in required.' })
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data?.user) return res.status(401).json({ error: 'Sign in required.' })
  const { data: isAdmin } = await admin.rpc('has_role', { _user_id: data.user.id, _role: 'admin' })
  if (!isAdmin) return res.status(403).json({ error: 'Admins only.' })

  return res.status(200).json({ checks: KEYS.map((c) => ({ ...c, configured: Boolean(process.env[c.key]?.trim()) })) })
}
