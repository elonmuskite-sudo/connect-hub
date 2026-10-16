import { createClient } from '@supabase/supabase-js'
import { IdentityLinkError, linkAppwriteIdentity, verifyAppwriteSession } from '../../server/appwriteIdentity.js'
import { createDatabasePool, withAuthenticatedDatabaseTransaction } from '../../server/appwriteDatabase.js'

function send(res, status, body) {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  return res.status(status).json(body)
}

function configuration() {
  const endpoint = String(process.env.APPWRITE_ENDPOINT || '').trim()
  const projectId = String(process.env.APPWRITE_PROJECT_ID || '').trim()
  const supabaseUrl = String(process.env.SUPABASE_URL || '').trim()
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  const poolerUrl = String(process.env.SUPABASE_POOLER_URL || '').trim()
  if (!endpoint || !projectId || !supabaseUrl || !serviceRoleKey || !poolerUrl) return null

  let parsedEndpoint
  let parsedPooler
  try {
    parsedEndpoint = new URL(endpoint)
    parsedPooler = new URL(poolerUrl)
  } catch {
    return null
  }
  const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(parsedEndpoint.hostname)
  const localHttpAllowed = process.env.NODE_ENV !== 'production' && isLocal && parsedEndpoint.protocol === 'http:'
  if (parsedEndpoint.protocol !== 'https:' && !localHttpAllowed) return null
  if (!['postgres:', 'postgresql:'].includes(parsedPooler.protocol)
    || !['require', 'verify-ca', 'verify-full'].includes(parsedPooler.searchParams.get('sslmode'))) return null
  return { endpoint: parsedEndpoint, projectId, supabaseUrl, serviceRoleKey, poolerUrl }
}

function getToken(req) {
  const match = String(req.headers.authorization || '').match(/^Bearer\s+(\S+)$/i)
  return match?.[1] && match[1].length <= 8192 ? match[1] : null
}

let poolPromise

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed.' })

  const config = configuration()
  if (!config) return send(res, 503, { error: 'The Appwrite data gateway is not configured on the server.' })
  const token = getToken(req)
  if (!token) return send(res, 401, { error: 'A valid Appwrite session is required.' })

  try {
    const account = await verifyAppwriteSession({
      endpoint: config.endpoint,
      projectId: config.projectId,
      token,
    })
    const admin = createClient(config.supabaseUrl, config.serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const identity = await linkAppwriteIdentity(admin, account)
    poolPromise ||= createDatabasePool(config.poolerUrl).catch((error) => {
      poolPromise = null
      throw error
    })
    const pool = await poolPromise
    const { rows } = await withAuthenticatedDatabaseTransaction(
      pool,
      identity.supabaseUserId,
      (client) => client.query(
        `select id, member_id, first_name, last_name, full_name, email, email_verified,
                avatar_url, bio, interests, created_at,
                public.has_role(id, 'admin'::public.app_role) as is_admin
           from public.members
          where id = $1`,
        [identity.supabaseUserId],
      ),
    )
    if (!rows[0]) return send(res, 404, { error: 'The linked profile is unavailable.' })
    const { is_admin: isAdmin, ...profile } = rows[0]
    return send(res, 200, { profile: { ...profile, role: isAdmin ? 'admin' : 'user' } })
  } catch (error) {
    if (error instanceof IdentityLinkError) return send(res, error.status, { error: error.message })
    console.error('Appwrite profile gateway failed', error)
    return send(res, 503, { error: 'Could not load your profile through the secure data gateway.' })
  }
}
