import test from 'node:test'
import assert from 'node:assert/strict'
import { linkAppwriteIdentity } from '../server/appwriteIdentity.js'
import { createDatabasePool, withAuthenticatedDatabaseTransaction } from '../server/appwriteDatabase.js'
import appwriteSessionHandler from '../api/auth/appwrite-session.js'
import appwriteProfileHandler from '../api/data/profile.js'

function createAdmin({ members = [], users = [], links = [], insertError = null } = {}) {
  const state = { members, users, links, insertError, memberLookups: 0 }
  const admin = {
    from(table) {
      assert.equal(table, 'appwrite_identity_links')
      return {
        select() {
          return {
            eq(column, value) {
              return {
                async maybeSingle() {
                  const row = state.links.find((item) => item.appwrite_user_id === value)
                  return { data: row || null, error: null }
                },
              }
            },
          }
        },
        insert(row) {
          return {
            async then(resolve) {
              if (state.insertError) return resolve({ error: state.insertError })
              state.links.push(row)
              return resolve({ error: null })
            },
          }
        },
      }
    },
    auth: {
      admin: {
        async getUserById(id) {
          const user = state.users.find((item) => item.id === id)
          return { data: { user: user || null }, error: user ? null : new Error('not found') }
        },
      },
    },
  }
  const from = admin.from.bind(admin)
  admin.from = (table) => {
    if (table !== 'members') return from(table)
    return {
      select() {
        return {
          eq(column, value) {
            assert.equal(column, 'email')
            return {
              async maybeSingle() {
                state.memberLookups += 1
                const member = state.members.find((item) => item.email === value)
                return { data: member || null, error: null }
              },
            }
          },
        }
      },
    }
  }
  return { admin, state }
}

test('requires a verified Appwrite email before linking', async () => {
  const { admin, state } = createAdmin()
  await assert.rejects(
    linkAppwriteIdentity(admin, { $id: 'app-user', email: 'person@example.com', emailVerification: false }),
    { status: 403 },
  )
  assert.equal(state.memberLookups, 0)
})

test('links a verified Appwrite account to the existing confirmed Supabase identity', async () => {
  const { admin, state } = createAdmin({
    members: [{ id: 'member-id', auth_user_id: 'auth-user-id', email: 'person@example.com' }],
    users: [{ id: 'auth-user-id', email: 'person@example.com', email_confirmed_at: '2026-01-01T00:00:00Z' }],
  })
  const identity = await linkAppwriteIdentity(admin, {
    $id: 'app-user',
    email: ' PERSON@example.com ',
    emailVerification: true,
  })
  assert.deepEqual(identity, {
    appwriteUserId: 'app-user',
    supabaseUserId: 'auth-user-id',
    email: 'person@example.com',
  })
  assert.deepEqual(state.links, [{
    appwrite_user_id: 'app-user',
    supabase_user_id: 'auth-user-id',
    linked_email: 'person@example.com',
  }])
})

test('rejects linking to an unconfirmed Supabase account', async () => {
  const { admin, state } = createAdmin({
    members: [{ id: 'auth-user-id', email: 'person@example.com' }],
    users: [{ id: 'auth-user-id', email: 'person@example.com', email_confirmed_at: null }],
  })
  await assert.rejects(
    linkAppwriteIdentity(admin, { $id: 'app-user', email: 'person@example.com', emailVerification: true }),
    { status: 409 },
  )
  assert.equal(state.links.length, 0)
})

test('keeps an existing identity link stable when the Appwrite email changes', async () => {
  const { admin } = createAdmin({
    users: [{ id: 'auth-user-id', email: 'old@example.com', email_confirmed_at: '2026-01-01T00:00:00Z' }],
    links: [{ appwrite_user_id: 'app-user', supabase_user_id: 'auth-user-id' }],
  })
  const identity = await linkAppwriteIdentity(admin, {
    $id: 'app-user',
    email: 'new@example.com',
    emailVerification: true,
  })
  assert.equal(identity.supabaseUserId, 'auth-user-id')
  assert.equal(identity.email, 'new@example.com')
})

test('does not let another Appwrite identity claim an already-linked Supabase account', async () => {
  const { admin, state } = createAdmin({
    members: [{ id: 'auth-user-id', email: 'person@example.com' }],
    users: [{ id: 'auth-user-id', email: 'person@example.com', email_confirmed_at: '2026-01-01T00:00:00Z' }],
    insertError: { code: '23505' },
  })
  await assert.rejects(
    linkAppwriteIdentity(admin, { $id: 'second-app-user', email: 'person@example.com', emailVerification: true }),
    { status: 409 },
  )
  assert.equal(state.links.length, 0)
})

test('provisions a Supabase identity and profile for a new verified Appwrite account', async () => {
  const userId = '123e4567-e89b-42d3-a456-426614174000'
  const state = { user: null, member: null, link: null, createOptions: null }
  const admin = {
    from(table) {
      if (table === 'members') {
        return {
          select() {
            return {
              eq(column, value) {
                assert.equal(column, 'email')
                return { async maybeSingle() { return { data: state.member?.email === value ? state.member : null, error: null } } }
              },
            }
          },
          async insert(row) {
            assert.equal(row.id, userId)
            assert.equal(row.auth_user_id, userId)
            return { error: { code: '23505' } }
          },
        }
      }
      assert.equal(table, 'appwrite_identity_links')
      return {
        select() {
          return {
            eq(_column, value) {
              return { async maybeSingle() { return { data: state.link?.appwrite_user_id === value ? state.link : null, error: null } } }
            },
          }
        },
        async insert(row) {
          state.link = row
          return { error: null }
        },
      }
    },
    auth: {
      admin: {
        async createUser(options) {
          state.createOptions = options
          state.user = {
            id: userId,
            email: options.email,
            email_confirmed_at: '2026-01-01T00:00:00Z',
          }
          state.member = { id: userId, auth_user_id: userId, email: options.email }
          return { data: { user: state.user }, error: null }
        },
        async getUserById(id) {
          return { data: { user: state.user?.id === id ? state.user : null }, error: null }
        },
        async deleteUser() {
          state.user = null
          return { error: null }
        },
      },
    },
  }
  const identity = await linkAppwriteIdentity(admin, {
    $id: 'new-appwrite-user',
    email: 'new@example.com',
    name: 'Nexus User',
    emailVerification: true,
  })

  assert.equal(identity.supabaseUserId, userId)
  assert.equal(state.link.supabase_user_id, userId)
  assert.equal(state.createOptions.email_confirm, true)
  assert.equal(state.createOptions.user_metadata.first_name, 'Nexus')
  assert.equal(state.createOptions.user_metadata.last_name, 'User')
  assert.ok(state.createOptions.password.length >= 32)
  assert.equal(state.createOptions.user_metadata.role, undefined)
})

test('the session endpoint rejects methods other than POST', async () => {
  const result = createResponse()
  await appwriteSessionHandler({ method: 'GET', headers: {} }, result.res)
  assert.equal(result.status, 405)
  assert.equal(result.body.error, 'Method not allowed.')
})

test('the profile gateway rejects methods other than GET', async () => {
  const result = createResponse()
  await appwriteProfileHandler({ method: 'POST', headers: {} }, result.res)
  assert.equal(result.status, 405)
  assert.equal(result.body.error, 'Method not allowed.')
})

test('the profile gateway fails closed when its server configuration is incomplete', async () => {
  const keys = ['APPWRITE_ENDPOINT', 'APPWRITE_PROJECT_ID', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_POOLER_URL']
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]))
  try {
    for (const key of keys) delete process.env[key]
    const result = createResponse()
    await appwriteProfileHandler({
      method: 'GET',
      headers: { authorization: 'Bearer appwrite-session' },
    }, result.res)
    assert.equal(result.status, 503)
    assert.match(result.body.error, /not configured/)
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key]
      else process.env[key] = previous[key]
    }
  }
})

test('the session endpoint fails closed when bridge configuration is incomplete', async () => {
  const keys = ['APPWRITE_ENDPOINT', 'APPWRITE_PROJECT_ID', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]))
  try {
    for (const key of keys) delete process.env[key]
    const result = createResponse()
    await appwriteSessionHandler({
      method: 'POST',
      headers: { authorization: 'Bearer appwrite-session' },
    }, result.res)
    assert.equal(result.status, 503)
    assert.match(result.body.error, /not configured/)
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key]
      else process.env[key] = previous[key]
    }
  }
})

test('the session endpoint rejects an invalid Appwrite JWT before touching Supabase', async () => {
  const keys = ['APPWRITE_ENDPOINT', 'APPWRITE_PROJECT_ID', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]))
  const originalFetch = globalThis.fetch
  try {
    process.env.APPWRITE_ENDPOINT = 'https://appwrite.example/v1'
    process.env.APPWRITE_PROJECT_ID = 'test-project'
    process.env.SUPABASE_URL = 'https://supabase.example'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role'
    globalThis.fetch = async (url, init) => {
      assert.equal(String(url), 'https://appwrite.example/v1/account')
      assert.equal(init.headers['X-Appwrite-Project'], 'test-project')
      assert.equal(init.headers['X-Appwrite-JWT'], 'invalid')
      return new Response('', { status: 401 })
    }
    const result = createResponse()
    await appwriteSessionHandler({
      method: 'POST',
      headers: { authorization: 'Bearer invalid' },
    }, result.res)
    assert.equal(result.status, 401)
    assert.equal(result.body.error, 'The Appwrite session is invalid or expired.')
  } finally {
    globalThis.fetch = originalFetch
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key]
      else process.env[key] = previous[key]
    }
  }
})

test('RLS database work runs in a transaction bound to the linked Supabase user', async () => {
  const statements = []
  const client = {
    async query(sql, values) {
      statements.push({ sql: String(sql).trim(), values })
      return { rows: [{ id: 'row-id' }] }
    },
    release() {
      statements.push({ sql: 'RELEASE' })
    },
  }
  const pool = { async connect() { return client } }
  const userId = '123e4567-e89b-42d3-a456-426614174000'
  const result = await withAuthenticatedDatabaseTransaction(pool, userId, async (transaction) => {
    return transaction.query('select id from public.members where id = $1', [userId])
  })

  assert.deepEqual(result.rows, [{ id: 'row-id' }])
  assert.equal(statements[0].sql, 'BEGIN')
  assert.equal(statements[1].sql, 'SET LOCAL ROLE authenticated')
  assert.match(statements[2].sql, /request\.jwt\.claim\.sub/)
  assert.deepEqual(JSON.parse(statements[2].values[1]), { sub: userId, role: 'authenticated' })
  assert.match(statements[2].values[2], /^appwrite-gateway:/)
  assert.equal(statements[4].sql, 'COMMIT')
  assert.equal(statements[5].sql, 'RELEASE')
})

test('RLS database work rolls back on query failure and always releases the connection', async () => {
  const statements = []
  const client = {
    async query(sql) {
      statements.push(String(sql).trim())
      if (String(sql).includes('select id from public.members')) throw new Error('database failed')
      return { rows: [] }
    },
    release() { statements.push('RELEASE') },
  }
  const pool = { async connect() { return client } }
  const userId = '123e4567-e89b-42d3-a456-426614174000'
  await assert.rejects(
    withAuthenticatedDatabaseTransaction(pool, userId, (transaction) => transaction.query('select id from public.members')),
    /database failed/,
  )
  assert.ok(statements.includes('ROLLBACK'))
  assert.equal(statements.at(-1), 'RELEASE')
  assert.ok(!statements.includes('COMMIT'))
})

test('RLS database context rejects invalid identities before connecting', async () => {
  let connected = false
  const pool = { async connect() { connected = true; throw new Error('unexpected connection') } }
  await assert.rejects(
    withAuthenticatedDatabaseTransaction(pool, 'not-a-uuid', async () => null),
    /valid linked Supabase user ID/,
  )
  assert.equal(connected, false)
})

test('database pool requires a Supabase postgres role and TLS', () => {
  assert.throws(
    () => createDatabasePool('postgresql://authenticated:password@db.example.com:6543/postgres?sslmode=require'),
    /must use the Supabase postgres role/,
  )
  assert.throws(
    () => createDatabasePool('postgresql://postgres.project:password@db.example.com:6543/postgres'),
    /must specify sslmode/,
  )
})

function createResponse() {
  const result = { status: null, body: null, headers: {} }
  result.res = {
    setHeader(name, value) {
      result.headers[name] = value
    },
    status(status) {
      result.status = status
      return this
    },
    json(body) {
      result.body = body
      return this
    },
  }
  return result
}
