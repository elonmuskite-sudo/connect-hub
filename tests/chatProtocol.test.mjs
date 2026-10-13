import test from 'node:test'
import assert from 'node:assert/strict'
import { encodeReply, decodeContent, reactionContent, resolveMessages } from '../src/lib/chatProtocol.js'

test('reply protocol preserves ordinary text and bounds quoted previews', () => {
  assert.deepEqual(decodeContent('hello'), { text: 'hello' })
  const result = decodeContent(encodeReply('answer', { id: 'm1', content: 'x'.repeat(300) }))
  assert.equal(result.text, 'answer')
  assert.equal(result.reply.preview.length, 160)
  assert.deepEqual(decodeContent('nexus:v1:broken'), { text: 'nexus:v1:broken' })
})
test('reactions toggle independently per user and stay hidden from transcript', () => {
  const message = { id: 'm1', content: 'hello', type: 'text', created_at: '2026-01-01' }
  const event = (id, user, active) => ({ id, sender_id: user, type: 'reaction', content: reactionContent('m1', '❤️', active), created_at: `2026-01-0${id}` })
  const resolved = resolveMessages([message, event('2', 'alice', true), event('3', 'bob', true), event('4', 'alice', false)])
  assert.equal(resolved.length, 1)
  assert.equal(resolved[0].reactions.length, 1)
  assert.equal(resolved[0].reactions[0].userId, 'bob')
  assert.throws(() => reactionContent('m1', 'invalid', true))
})