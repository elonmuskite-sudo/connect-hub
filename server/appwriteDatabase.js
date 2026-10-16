import { randomUUID } from 'node:crypto'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function withAuthenticatedDatabaseTransaction(pool, supabaseUserId, operation) {
  if (!UUID_PATTERN.test(String(supabaseUserId || ''))) {
    throw new Error('A valid linked Supabase user ID is required.')
  }
  if (typeof operation !== 'function') throw new TypeError('A database operation is required.')

  const client = await pool.connect()
  const requestId = randomUUID()
  try {
    await client.query('BEGIN')
    await client.query('SET LOCAL ROLE authenticated')
    await client.query(
      `select
        set_config('request.jwt.claim.sub', $1, true),
        set_config('request.jwt.claim.role', 'authenticated', true),
        set_config('request.jwt.claims', $2, true),
        set_config('application_name', $3, true)`,
      [supabaseUserId, JSON.stringify({ sub: supabaseUserId, role: 'authenticated' }), `appwrite-gateway:${requestId}`],
    )
    const result = await operation(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    try {
      await client.query('ROLLBACK')
    } catch (rollbackError) {
      console.error('Appwrite database transaction rollback failed', rollbackError)
    }
    throw error
  } finally {
    client.release()
  }
}

export function createDatabasePool(connectionString) {
  if (!connectionString) throw new Error('SUPABASE_POOLER_URL is not configured.')
  const parsed = new URL(connectionString)
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    throw new Error('SUPABASE_POOLER_URL must be a PostgreSQL connection URL.')
  }
  if (!/^postgres(?:\.[a-z0-9-]+)?$/i.test(decodeURIComponent(parsed.username))) {
    throw new Error('SUPABASE_POOLER_URL must use the Supabase postgres role so requests can switch to RLS-protected user access.')
  }
  if (!['require', 'verify-ca', 'verify-full'].includes(parsed.searchParams.get('sslmode'))) {
    throw new Error('SUPABASE_POOLER_URL must specify sslmode=require or stricter.')
  }
  return import('pg').then(({ Pool }) => new Pool({
    connectionString,
    max: 3,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 10000,
    allowExitOnIdle: true,
  }))
}
