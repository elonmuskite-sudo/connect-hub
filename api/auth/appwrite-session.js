import { createClient } from '@supabase/supabase-js'
import { IdentityLinkError, linkAppwriteIdentity, verifyAppwriteSession } from '../../server/appwriteIdentity.js'

function send(res, status, body) {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  return res.status(status).json(body)
}

function appwriteEndpoint() {
  const value = String(process.env.APPWRITE_ENDPOINT || '').trim()
  if (!value) return null
  let endpoint
  try {
    endpoint = new URL(value)
  } catch {
    return null
  }
  const localHost = ['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname)
  if (endpoint.protocol !== 'https:' && !(process.env.NODE_ENV !== 'production' && localHost && endpoint.protocol === 'http:')) {
    return null
  }
  return endpoint
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed.' })

  const endpoint = appwriteEndpoint()
  const projectId = String(process.env.APPWRITE_PROJECT_ID || '').trim()
  const supabaseUrl = String(process.env.SUPABASE_URL || '').trim()
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  if (!endpoint || !projectId || !supabaseUrl || !serviceRoleKey) {
    return send(res, 503, { error: 'The Appwrite identity bridge is not configured on the server.' })
  }

  const authorization = String(req.headers.authorization || '')
  const token = authorization.match(/^Bearer\s+(\S+)$/i)?.[1]
  if (!token || token.length > 8192) return send(res, 401, { error: 'A valid Appwrite session is required.' })

  let account
  try {
    account = await verifyAppwriteSession({ endpoint, projectId, token })
  } catch (error) {
    if (error instanceof IdentityLinkError) {
      return send(res, error.status, { error: error.message })
    }
    console.error('Appwrite identity verification request failed', error)
    return send(res, 503, { error: 'Appwrite identity verification is temporarily unavailable.' })
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  try {
    const identity = await linkAppwriteIdentity(admin, account)
    return send(res, 200, { identity: { id: identity.supabaseUserId, email: identity.email } })
  } catch (error) {
    if (error instanceof IdentityLinkError) {
      return send(res, error.status, { error: error.message })
    }
    console.error('Appwrite-to-Supabase identity linking failed', error)
    return send(res, 503, { error: 'Account linking is temporarily unavailable.' })
  }
}
