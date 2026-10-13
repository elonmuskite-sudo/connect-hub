import { createDecipheriv, createHash, createCipheriv, randomBytes, randomInt, timingSafeEqual } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const COOKIE_NAME = 'nexus_auth_email_code'
const CODE_TTL_SECONDS = 600
const RATE_LIMIT_WINDOW_SECONDS = 60
const RATE_LIMIT_PER_WINDOW = 3

function json(res, status, body) {
  res.setHeader('Cache-Control', 'no-store')
  res.status(status).json(body)
}

function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body
  if (typeof req.body === 'string') return JSON.parse(req.body)
  return {}
}

function normalizedEmail(value) {
  return String(value || '').trim().toLowerCase()
}

function secureOrigin(req) {
  const origin = req.headers.origin
  const host = req.headers.host
  if (!origin || !host) return null
  try {
    const parsed = new URL(origin)
    if (parsed.host !== host) return null
    if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost') return null
    return parsed.origin
  } catch {
    return null
  }
}

function encryptionKey(secret) {
  return createHash('sha256').update(secret).digest()
}

function encryptPayload(payload, secret) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(secret), iv)
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload)), cipher.final()])
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url')
}

function decryptPayload(value, secret) {
  try {
    const packed = Buffer.from(value, 'base64url')
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey(secret), packed.subarray(0, 12))
    decipher.setAuthTag(packed.subarray(12, 28))
    const plaintext = Buffer.concat([decipher.update(packed.subarray(28)), decipher.final()])
    return JSON.parse(plaintext.toString('utf8'))
  } catch {
    return null
  }
}

function getCookie(req, name) {
  const entry = String(req.headers.cookie || '').split(';').map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : ''
}

function setCodeCookie(req, res, payload, secret) {
  const secure = req.headers['x-forwarded-proto'] === 'https' || process.env.NODE_ENV === 'production'
  const cookie = `${COOKIE_NAME}=${encodeURIComponent(encryptPayload(payload, secret))}; Path=/api/auth; Max-Age=${CODE_TTL_SECONDS}; HttpOnly; SameSite=Strict${secure ? '; Secure' : ''}`
  res.setHeader('Set-Cookie', cookie)
}

function clearCodeCookie(req, res) {
  const secure = req.headers['x-forwarded-proto'] === 'https' || process.env.NODE_ENV === 'production'
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/api/auth; Max-Age=0; HttpOnly; SameSite=Strict${secure ? '; Secure' : ''}`)
}

async function checkSendLimit(admin, purpose, email) {
  const bucketKey = createHash('sha256').update(`${purpose}:${email}`).digest('hex')
  const { data, error } = await admin.rpc('consume_auth_email_code_limit', {
    p_bucket_key: bucketKey,
    p_window_seconds: RATE_LIMIT_WINDOW_SECONDS,
    p_limit: RATE_LIMIT_PER_WINDOW,
  })
  if (error) throw new Error('Email code rate limiting is unavailable. Apply the latest Supabase schema migration.')
  return data === true
}

function codeMatches(provided, expected) {
  const providedBytes = Buffer.from(String(provided || ''))
  const expectedBytes = Buffer.from(String(expected || ''))
  return providedBytes.length === 6
    && expectedBytes.length === 6
    && timingSafeEqual(providedBytes, expectedBytes)
}

function generateVerificationCode(previousCode) {
  const candidate = String(randomInt(0, 1_000_000)).padStart(6, '0')
  if (!previousCode || candidate !== previousCode) return candidate
  return String((Number.parseInt(candidate, 10) + 1) % 1_000_000).padStart(6, '0')
}

async function sendWithResend({ email, code, purpose, apiKey, from }) {
  const subject = purpose === 'signup' ? 'Verify your Nexus Chat email' : 'Reset your Nexus Chat password'
  const action = purpose === 'signup' ? 'verify your email address' : 'reset your password'
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject,
      text: `Your Nexus Chat verification code is ${code}. Enter this code to ${action}. It expires in 10 minutes. If you did not request this, ignore this email.`,
      html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px;color:#172033"><h1 style="font-size:22px">Nexus Chat</h1><p>Use this code to ${action}:</p><p style="font-size:32px;font-weight:700;letter-spacing:8px">${code}</p><p>This code expires in 10 minutes. If you did not request this, you can ignore this email.</p></div>`,
    }),
  })

  if (!response.ok) throw new Error('Email delivery failed. Check the Resend API key and verified sender domain.')
}

async function resolvePendingUser(admin, email, purpose, fallbackUserId) {
  if (purpose === 'signup') {
    try {
      const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
      if (error) return fallbackUserId ? { id: fallbackUserId } : null
      const user = data?.users?.find((item) => normalizedEmail(item.email) === normalizedEmail(email))
      if (!user) return fallbackUserId ? { id: fallbackUserId } : null
      return user
    } catch {
      return fallbackUserId ? { id: fallbackUserId } : null
    }
  }

  const { data, error } = await admin.from('members').select('auth_user_id').eq('email', email).maybeSingle()
  if (error || !data?.auth_user_id) return fallbackUserId ? { id: fallbackUserId } : null
  return { id: data.auth_user_id }
}

function createAdminClient(url, serviceRoleKey) {
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return json(res, 405, { error: 'Method not allowed.' })
  }

  const origin = secureOrigin(req)
  if (!origin) return json(res, 403, { error: 'Invalid request origin.' })

  const supabaseUrl = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const resendApiKey = process.env.RESEND_API_KEY
  const sender = process.env.RESEND_FROM
  if (!supabaseUrl || !serviceRoleKey || !resendApiKey || !sender) {
    return json(res, 503, { error: 'Email verification is not configured on the server.' })
  }

  let body
  try {
    body = readBody(req)
  } catch {
    return json(res, 400, { error: 'Invalid request body.' })
  }

  const action = String(body.action || '')
  const purpose = String(body.purpose || (action === 'signup' ? 'signup' : ''))
  const email = normalizedEmail(body.email)
  if (!['signup', 'recovery'].includes(purpose) || !email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json(res, 400, { error: 'Enter a valid email address.' })
  }

  const admin = createAdminClient(supabaseUrl, serviceRoleKey)

  if (action === 'resend') {
    const saved = decryptPayload(getCookie(req, COOKIE_NAME), serviceRoleKey)
    const hasSavedCode = saved && saved.email === email && saved.purpose === purpose
    const needsRefresh = !hasSavedCode || saved.expiresAt < Date.now()

    const user = needsRefresh
      ? (await resolvePendingUser(admin, email, purpose, saved?.userId))
      : { id: saved.userId }

    if (!user) return json(res, 200, { ok: true })

    let allowed
    try {
      allowed = await checkSendLimit(admin, purpose, email)
    } catch (error) {
      return json(res, 503, { error: error.message })
    }
    if (!allowed) return json(res, 429, { error: 'Please wait a minute before requesting another code.' })

    const code = generateVerificationCode(saved?.code)
    const payload = {
      email,
      purpose,
      code,
      userId: user.id,
      attempts: 0,
      expiresAt: Date.now() + CODE_TTL_SECONDS * 1000,
    }

    try {
      await sendWithResend({ email, code, purpose, apiKey: resendApiKey, from: sender })
      setCodeCookie(req, res, payload, serviceRoleKey)
      return json(res, 200, { ok: true })
    } catch (error) {
      return json(res, 502, { error: error.message })
    }
  }

  if (action === 'verify') {
    const saved = decryptPayload(getCookie(req, COOKIE_NAME), serviceRoleKey)
    if (!saved || saved.email !== email || saved.purpose !== purpose) {
      clearCodeCookie(req, res)
      return json(res, 400, { error: 'This code expired. Request a new one.' })
    }
    if (saved.expiresAt < Date.now()) {
      clearCodeCookie(req, res)
      return json(res, 400, { error: 'This code expired. Request a new one.' })
    }
    if (saved.attempts >= 5) {
      clearCodeCookie(req, res)
      return json(res, 429, { error: 'Too many incorrect attempts. Request a new code.' })
    }
    if (!codeMatches(body.code, saved.code)) {
      saved.attempts += 1
      setCodeCookie(req, res, saved, serviceRoleKey)
      return json(res, 400, { error: 'That code is not valid. Check it and try again.' })
    }

    if (purpose === 'signup') {
      const { error: confirmError } = await admin.auth.admin.updateUserById(saved.userId, { email_confirm: true })
      if (confirmError) return json(res, 502, { error: 'Could not confirm the account. Please try the code again.' })
    }

    const verificationType = purpose === 'signup' ? 'magiclink' : 'recovery'
    const { data, error } = await admin.auth.admin.generateLink({
      type: verificationType,
      email,
    })
    if (error || !data?.properties?.hashed_token) {
      return json(res, 502, { error: 'Could not complete verification. Please try again.' })
    }

    clearCodeCookie(req, res)
    return json(res, 200, { ok: true, tokenHash: data.properties.hashed_token, verificationType })
  }

  if ((action !== 'signup' && action !== 'recovery') || action !== purpose) {
    return json(res, 400, { error: 'Invalid email code action.' })
  }
  let allowed
  try {
    allowed = await checkSendLimit(admin, purpose, email)
  } catch (error) {
    return json(res, 503, { error: error.message })
  }
  if (!allowed) return json(res, 429, { error: 'Please wait a minute before requesting another code.' })

  let generated
  if (purpose === 'signup') {
    const password = String(body.password || '')
    const firstName = String(body.firstName || '').trim()
    const lastName = String(body.lastName || '').trim()
    const memberId = String(body.memberId || '')
    if (password.length < 8 || firstName.length > 128 || lastName.length > 128 || !/^10\d{8}$/.test(memberId)) {
      return json(res, 400, { error: 'Provide a valid name, an 8-character password, and a valid member ID.' })
    }
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
      user_metadata: { first_name: firstName, last_name: lastName, member_id: memberId },
    })
    if (error) return json(res, 400, { error: error.message })
    generated = { user: data.user }
  } else {
    const { data, error } = await admin
      .from('members')
      .select('auth_user_id')
      .eq('email', email)
      .maybeSingle()
    if (error) return json(res, 502, { error: 'Unable to send a recovery code right now.' })
    if (!data?.auth_user_id) return json(res, 200, { ok: true })
    generated = { user: { id: data.auth_user_id } }
  }

  const code = generateVerificationCode()

  setCodeCookie(req, res, {
    email,
    purpose,
    code,
    userId: generated.user.id,
    attempts: 0,
    expiresAt: Date.now() + CODE_TTL_SECONDS * 1000,
  }, serviceRoleKey)

  try {
    await sendWithResend({ email, code, purpose, apiKey: resendApiKey, from: sender })
    return json(res, 200, { ok: true })
  } catch (error) {
    return json(res, 502, {
      error: error.message,
      verificationPending: purpose === 'signup',
    })
  }
}