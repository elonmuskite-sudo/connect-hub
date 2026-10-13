import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || ''

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null

export function isSupabaseConfigured() {
  return Boolean(supabase && supabaseUrl && supabaseAnonKey)
}

const EMAIL_CODE_STATE_KEY = 'nexus_auth_email_code_state'

function readEmailCodeState() {
  try {
    return sessionStorage.getItem(EMAIL_CODE_STATE_KEY) || ''
  } catch {
    return ''
  }
}

function writeEmailCodeState(state) {
  try {
    if (state) sessionStorage.setItem(EMAIL_CODE_STATE_KEY, state)
    else sessionStorage.removeItem(EMAIL_CODE_STATE_KEY)
  } catch {
    // sessionStorage unavailable; the flow will require a fresh code
  }
}

async function requestEmailCode(body) {
  if (!supabase) throw new Error('Supabase Auth is not configured.')
  const { data: result, error: invokeError } = await supabase.functions.invoke('email-code', {
    body: { ...body, state: readEmailCodeState() },
  })
  if (invokeError) {
    const message = result?.error || invokeError.message || 'Could not send the email code.'
    const error = new Error(message)
    error.verificationPending = Boolean(result?.verificationPending)
    throw error
  }
  if (result?.error) {
    const error = new Error(result.error)
    error.verificationPending = Boolean(result.verificationPending)
    if (result.state) writeEmailCodeState(result.state)
    throw error
  }
  if (body.action === 'verify') writeEmailCodeState('')
  else if (result?.state) writeEmailCodeState(result.state)
  return result
}

export async function startSignupEmailCode({ email, password, firstName, lastName, memberId }) {
  return requestEmailCode({
    action: 'signup',
    purpose: 'signup',
    email,
    password,
    firstName,
    lastName,
    memberId,
  })
}

export async function verifyEmailCode(email, token, type = 'signup', password = '') {
  if (!supabase) throw new Error('Supabase Auth is not configured.')
  const purpose = type === 'recovery' ? 'recovery' : 'signup'
  const result = await requestEmailCode({
    action: 'verify',
    purpose,
    email,
    code: String(token || '').trim(),
  })

  if (purpose === 'signup' && password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: String(email || '').trim().toLowerCase(),
      password,
    })
    if (error) throw error
    return data
  }

  return result
}

export async function resendEmailCode(email, purpose) {
  return requestEmailCode({
    action: 'resend',
    purpose,
    email,
  })
}

export async function signInWithEmail(email, password) {
  if (!supabase) throw new Error('Supabase Auth is not configured.')
  const { data, error } = await supabase.auth.signInWithPassword({
    email: String(email || '').trim().toLowerCase(),
    password,
  })
  if (error) throw error
  return data
}

export async function signOutFromSupabase() {
  if (!supabase) return
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function startPasswordRecoveryCode(email) {
  return requestEmailCode({
    action: 'recovery',
    purpose: 'recovery',
    email,
  })
}

export async function updateAuthenticatedPassword(password) {
  if (!supabase) throw new Error('Supabase Auth is not configured.')
  const { data, error } = await supabase.auth.updateUser({ password })
  if (error) throw error
  return data
}

export async function getMemberProfile(userId) {
  if (!supabase) throw new Error('Supabase Auth is not configured.')
  const { data, error } = await supabase
    .from('members')
    .select('id, member_id, first_name, last_name, full_name, email, email_verified, avatar_url, bio, interests, created_at')
    .eq('id', userId)
    .single()
  if (error) throw error
  const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: userId, _role: 'admin' })
  return { ...data, role: isAdmin ? 'admin' : 'user' }
}

export async function findMemberByNexusId(nexusId) {
  if (!supabase) throw new Error('Supabase Auth is not configured.')
  const normalizedId = String(nexusId || '').replace(/\D/g, '')
  if (!/^10\d{8}$/.test(normalizedId)) return null

  const { data, error } = await supabase.rpc('lookup_member_by_nexus_id', {
    p_member_id: normalizedId,
  })
  if (error) {
    if (error.code === 'PGRST202' || String(error.message || '').includes('lookup_member_by_nexus_id')) {
      throw new Error('Recipient lookup migration is not installed. An administrator must run the reviewed Supabase migrations first.')
    }
    throw error
  }
  const member = Array.isArray(data) ? data[0] : data
  if (!member) return null
  return {
    id: member.id,
    nexusId: member.member_id,
    nexusIdDisplay: formatMemberId(member.member_id),
    firstName: member.first_name,
    lastName: member.last_name,
    fullName: member.full_name,
    avatarUrl: member.avatar_url || null,
  }
}

function formatMemberId(value) {
  const digits = String(value || '').replace(/\D/g, '')
  return digits.length === 10 ? `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}` : digits
}

export async function updateMemberProfile(userId, updates) {
  if (!supabase) throw new Error('Supabase Auth is not configured.')
  const profileUpdates = {}
  if (updates.firstName !== undefined) profileUpdates.first_name = updates.firstName
  if (updates.lastName !== undefined) profileUpdates.last_name = updates.lastName
  if (updates.fullName !== undefined) profileUpdates.full_name = updates.fullName
  if (updates.avatarUrl !== undefined) profileUpdates.avatar_url = updates.avatarUrl
  if (updates.bio !== undefined) profileUpdates.bio = updates.bio
  if (updates.interests !== undefined) profileUpdates.interests = updates.interests

  const { data, error } = await supabase
    .from('members')
    .update(profileUpdates)
    .eq('id', userId)
    .select('id, member_id, first_name, last_name, full_name, email, email_verified, avatar_url, bio, interests, created_at')
    .single()
  if (error) throw error
  const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: userId, _role: 'admin' })
  return { ...data, role: isAdmin ? 'admin' : 'user' }
}

export function getSupabaseConfig() {
  return {
    url: supabaseUrl,
    anonKey: supabaseAnonKey,
    configured: isSupabaseConfigured(),
  }
}
