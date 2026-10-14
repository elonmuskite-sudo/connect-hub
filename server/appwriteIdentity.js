import { randomBytes } from 'node:crypto'

export class IdentityLinkError extends Error {
  constructor(message, status = 503) {
    super(message)
    this.name = 'IdentityLinkError'
    this.status = status
  }
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase()
}

export async function verifyAppwriteSession({ endpoint, projectId, token, fetchImpl = fetch }) {
  const accountUrl = new URL('/v1/account', endpoint)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)
  let response
  try {
    response = await fetchImpl(accountUrl, {
      headers: {
        'X-Appwrite-Project': projectId,
        'X-Appwrite-JWT': token,
      },
      signal: controller.signal,
    })
  } catch (error) {
    throw new IdentityLinkError('Appwrite identity verification is temporarily unavailable.')
  } finally {
    clearTimeout(timeout)
  }

  if (response.status === 401 || response.status === 403) {
    throw new IdentityLinkError('The Appwrite session is invalid or expired.', 401)
  }
  if (!response.ok) {
    throw new IdentityLinkError('Appwrite identity verification failed.')
  }

  try {
    return await response.json()
  } catch {
    throw new IdentityLinkError('Appwrite returned an invalid identity response.')
  }
}

async function loadLinkedUser(admin, appwriteUserId) {
  const { data, error } = await admin
    .from('appwrite_identity_links')
    .select('supabase_user_id')
    .eq('appwrite_user_id', appwriteUserId)
    .maybeSingle()
  if (error) throw new IdentityLinkError('Could not load the linked account.')
  return data?.supabase_user_id || null
}

async function getSupabaseUser(admin, userId) {
  const { data, error } = await admin.auth.admin.getUserById(userId)
  const user = data?.user
  if (error) throw new IdentityLinkError('Could not verify the linked account.')
  if (!user) throw new IdentityLinkError('The linked account is unavailable.', 409)
  return user
}

function ensureVerifiedMatchingEmail(user, expectedEmail) {
  if (!user.email_confirmed_at || normalizeEmail(user.email) !== expectedEmail) {
    throw new IdentityLinkError('The linked account does not have a verified matching email.', 409)
  }
}

async function provisionSupabaseIdentity(admin, appwriteUser, email) {
  const nameParts = String(appwriteUser.name || '').trim().split(/\s+/).filter(Boolean)
  const password = randomBytes(48).toString('base64url')
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      first_name: nameParts[0] || '',
      last_name: nameParts.slice(1).join(' '),
    },
  })
  if (error || !data?.user?.id) {
    if (error?.code === 'email_exists' || error?.message?.toLowerCase().includes('already been registered')) {
      throw new IdentityLinkError('A Supabase account already exists for this email but has no profile link. An administrator must reconcile the account.', 409)
    }
    throw new IdentityLinkError('Could not provision the linked Supabase identity.')
  }

  const supabaseUserId = data.user.id
  const memberId = `10${randomBytes(4).readUInt32BE(0).toString().padStart(10, '0').slice(-8)}`
  const { error: memberInsertError } = await admin.from('members').insert({
    id: supabaseUserId,
    auth_user_id: supabaseUserId,
    member_id: memberId,
    first_name: nameParts[0] || null,
    last_name: nameParts.slice(1).join(' ') || null,
    full_name: nameParts.join(' ') || null,
    email,
    email_verified: true,
  })
  if (memberInsertError && memberInsertError.code !== '23505') {
    const { error: cleanupError } = await admin.auth.admin.deleteUser(supabaseUserId)
    if (cleanupError) console.error('Failed to clean up a partially provisioned Supabase identity', cleanupError)
    throw new IdentityLinkError('Could not provision the linked profile.')
  }
  if (memberInsertError) {
    const { data: existingMember, error: lookupError } = await admin
      .from('members')
      .select('id, auth_user_id, email')
      .eq('email', email)
      .maybeSingle()
    if (lookupError || String(existingMember?.auth_user_id || existingMember?.id || '') !== supabaseUserId) {
      const { error: cleanupError } = await admin.auth.admin.deleteUser(supabaseUserId)
      if (cleanupError) console.error('Failed to clean up a partially provisioned Supabase identity', cleanupError)
      throw new IdentityLinkError('The linked profile could not be reconciled.', 409)
    }
  }
  return supabaseUserId
}

export async function linkAppwriteIdentity(admin, appwriteUser) {
  const appwriteUserId = String(appwriteUser?.$id || '').trim()
  const email = normalizeEmail(appwriteUser?.email)
  if (!appwriteUserId || appwriteUser.emailVerification !== true || !email) {
    throw new IdentityLinkError('A verified Appwrite email is required.', 403)
  }

  const existingUserId = await loadLinkedUser(admin, appwriteUserId)
  if (existingUserId) {
    await getSupabaseUser(admin, existingUserId)
    return { appwriteUserId, supabaseUserId: existingUserId, email }
  }

  const { data: member, error: memberError } = await admin
    .from('members')
    .select('id, auth_user_id, email')
    .eq('email', email)
    .maybeSingle()
  if (memberError) throw new IdentityLinkError('Could not look up the existing account.')

  let supabaseUserId
  if (member) {
    supabaseUserId = String(member.auth_user_id || member.id || '')
    if (!supabaseUserId) throw new IdentityLinkError('The existing account has no linked authentication ID.', 409)
    ensureVerifiedMatchingEmail(await getSupabaseUser(admin, supabaseUserId), email)
  } else {
    supabaseUserId = await provisionSupabaseIdentity(admin, appwriteUser, email)
  }

  const { error: insertError } = await admin
    .from('appwrite_identity_links')
    .insert({
      appwrite_user_id: appwriteUserId,
      supabase_user_id: supabaseUserId,
      linked_email: email,
    })
  if (insertError) {
    if (insertError.code === '23505') {
      const racedUserId = await loadLinkedUser(admin, appwriteUserId)
      if (racedUserId === supabaseUserId) {
        return { appwriteUserId, supabaseUserId, email }
      }
      throw new IdentityLinkError('This account is already linked to another identity.', 409)
    }
    throw new IdentityLinkError('Could not securely link the accounts.')
  }

  return { appwriteUserId, supabaseUserId, email }
}
