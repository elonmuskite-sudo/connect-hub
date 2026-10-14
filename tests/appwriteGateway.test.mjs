import test from 'node:test'
import assert from 'node:assert/strict'
import { executeUserDataOperation } from '../server/appwriteGateway.js'

const userId = '123e4567-e89b-42d3-a456-426614174000'

function makeClient(handler) {
  const calls = []
  return {
    calls,
    async query(sql, values = []) {
      calls.push({ sql: String(sql), values })
      return handler(String(sql), values)
    },
  }
}

test('message insert binds its sender to the verified linked Supabase identity', async () => {
  const client = makeClient((sql, values) => {
    assert.match(sql, /insert into public\.messages/)
    return { rows: [{ id: values[0], sender_id: values[2], content: values[3] }] }
  })
  const result = await executeUserDataOperation(client, { supabaseUserId: userId }, {
    action: 'messages.send',
    chatId: '123e4567-e89b-42d3-a456-426614174001',
    senderId: '123e4567-e89b-42d3-a456-426614174099',
    content: 'hello',
  })

  assert.equal(result.message.sender_id, userId)
  assert.equal(client.calls[0].values[2], userId)
})

test('message polling advances its authenticated composite cursor without skipping ties', async () => {
  const lastMessage = {
    id: '123e4567-e89b-42d3-a456-426614174004',
    created_at: '2026-10-14T00:00:01.000Z',
  }
  const client = makeClient((sql, values) => {
    assert.match(sql, /where \(m\.created_at, m\.id\) > \(\$1::timestamptz, \$2::uuid\)/)
    assert.deepEqual(values, ['2026-10-14T00:00:00.000Z', '00000000-0000-1000-8000-000000000000'])
    return { rows: [{ ...lastMessage, chat_id: 'chat-id' }] }
  })
  const result = await executeUserDataOperation(client, { supabaseUserId: userId }, {
    action: 'events.poll',
    since: '2026-10-14T00:00:00.000Z',
    afterId: '00000000-0000-1000-8000-000000000000',
  })

  assert.deepEqual(result.cursor, { since: lastMessage.created_at, afterId: lastMessage.id })
})

test('storage upload preparation scopes the object path and database row to the verified user', async () => {
  const client = makeClient((sql, values) => {
    if (sql.includes('pg_advisory_xact_lock')) return { rows: [] }
    if (sql.includes('sum(size_bytes)')) return { rows: [{ used_bytes: 0 }] }
    if (sql.includes('user_storage_quotas')) return { rows: [{ quota_bytes: 1000000 }] }
    if (sql.includes('insert into public.storage_files')) {
      assert.equal(values[0], userId)
      assert.match(values[7], new RegExp(`^${userId}/direct/`))
      return { rows: [{ id: '123e4567-e89b-42d3-a456-426614174002' }] }
    }
    assert.fail(`Unexpected query: ${sql}`)
  })
  let requestedPath
  const admin = {
    storage: {
      from(bucket) {
        assert.equal(bucket, 'chat-files')
        return {
          async createSignedUploadUrl(path) {
            requestedPath = path
            return { data: { token: 'scoped-upload-token' }, error: null }
          },
        }
      },
    },
  }

  const result = await executeUserDataOperation(client, { supabaseUserId: userId }, {
    action: 'storage.upload.prepare',
    fileName: 'avatar image.png',
    fileType: 'image',
    mimeType: 'image/png',
    sizeBytes: 1234,
  }, admin)

  assert.equal(result.token, 'scoped-upload-token')
  assert.equal(result.path, requestedPath)
  assert.match(result.path, new RegExp(`^${userId}/direct/`))
})

test('storage upload preparation rejects unsupported sizes before writing metadata', async () => {
  const client = makeClient(() => assert.fail('Invalid file must be rejected before database access'))
  await assert.rejects(
    executeUserDataOperation(client, { supabaseUserId: userId }, {
      action: 'storage.upload.prepare',
      fileName: 'large.bin',
      fileType: 'file',
      mimeType: 'application/octet-stream',
      sizeBytes: 51 * 1024 * 1024,
    }, {}),
    { status: 400 },
  )
  assert.equal(client.calls.length, 0)
})

test('storage deletion removes only paths selected under the authenticated RLS context', async () => {
  const client = makeClient((sql, values) => {
    if (sql.includes('select id, storage_path')) {
      return { rows: [{ id: values[0][0], storage_path: `${userId}/direct/file.png` }] }
    }
    if (sql.includes('delete from public.storage_files')) {
      assert.deepEqual(values[0], ['123e4567-e89b-42d3-a456-426614174003'])
      return { rowCount: 1, rows: [] }
    }
    assert.fail(`Unexpected query: ${sql}`)
  })
  let removed
  const admin = {
    storage: {
      from() {
        return {
          async remove(paths) {
            removed = paths
            return { error: null }
          },
        }
      },
    },
  }
  const result = await executeUserDataOperation(client, { supabaseUserId: userId }, {
    action: 'storage.delete',
    fileIds: ['123e4567-e89b-42d3-a456-426614174003'],
  }, admin)

  assert.deepEqual(removed, [`${userId}/direct/file.png`])
  assert.deepEqual(result, { deleted: 1 })
})
