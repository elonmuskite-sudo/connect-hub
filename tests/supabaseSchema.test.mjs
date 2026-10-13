import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { inspectSupabaseSchema, verifySupabaseApiCredentials } from '../scripts/lib/supabase-schema.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

test('schema dry-run validates checked-in versioned migrations without connecting', () => {
  const result = inspectSupabaseSchema({
    databaseUrl: 'postgresql://test:test@db.example.invalid:5432/postgres',
    root,
  })

  assert.equal(result.migrationDir, path.join(root, 'supabase', 'migrations'))
  assert.equal(result.migrations.length, 2)
  assert.equal(result.migrations[0].file, '20261006000000_initial_nexus_schema.sql')
  assert.equal(result.migrations[1].file, '20261006010000_authenticated_member_lookup.sql')
  assert.ok(result.migrations[0].bytes > 0)
  assert.match(result.migrations[0].checksum, /^[a-f0-9]{64}$/)
})

test('schema dry-run rejects non-PostgreSQL URLs', () => {
  assert.throws(
    () => inspectSupabaseSchema({ databaseUrl: 'https://example.invalid/database', root }),
    /postgres:\/\/ or postgresql:\/\//,
  )
})

test('schema dry-run requires a database URL', () => {
  assert.throws(
    () => inspectSupabaseSchema({ databaseUrl: '', root }),
    /SUPABASE_DB_URL is required/,
  )
})

test('build environment validation does not execute schema migrations', () => {
  const validator = fs.readFileSync(path.join(root, 'scripts', 'validate-production-env.js'), 'utf8')
  assert.doesNotMatch(validator, /applySupabase|syncAppwriteSchema|verifyAppwriteSetup/)
})

test('API preflight checks anon and service-role credentials without exposing them', async () => {
  const requests = []
  const result = await verifySupabaseApiCredentials({
    supabaseUrl: 'https://project.example.supabase.co',
    anonKey: 'public-anon-test-key',
    serviceRoleKey: 'private-service-test-key',
    fetchImpl: async (url, options) => {
      requests.push({ url, key: options.headers.apikey })
      return { ok: true, status: 200 }
    },
  })

  assert.equal(result.ok, true)
  assert.deepEqual(result.checks.map((check) => check.name), ['Supabase anon key', 'Supabase service-role key'])
  assert.match(requests[0].url, /\/auth\/v1\/settings$/)
  assert.match(requests[1].url, /\/auth\/v1\/admin\/users/)
  assert.equal(requests[0].key, 'public-anon-test-key')
  assert.equal(requests[1].key, 'private-service-test-key')
})

test('API preflight rejects a bad service-role key without echoing it', async () => {
  await assert.rejects(
    verifySupabaseApiCredentials({
      supabaseUrl: 'https://project.example.supabase.co',
      anonKey: 'public-anon-test-key',
      serviceRoleKey: 'private-service-test-key',
      fetchImpl: async (_url, options) => options.headers.apikey === 'private-service-test-key'
        ? { ok: false, status: 401 }
        : { ok: true, status: 200 },
    }),
    (error) => error.message.includes('HTTP 401') && !error.message.includes('private-service-test-key'),
  )
})
