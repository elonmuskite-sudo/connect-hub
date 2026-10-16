import assert from 'node:assert/strict'
import test from 'node:test'
import { isPasswordPwned } from '../src/lib/pwnedPasswords.js'

const leakedPasswordHash = '5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8'

function cryptoForHash(hash) {
  return {
    subtle: {
      digest: async (algorithm, input) => {
        assert.equal(algorithm, 'SHA-1')
        assert.equal(new TextDecoder().decode(input), 'password')
        return Uint8Array.from(hash.match(/.{2}/g), (byte) => Number.parseInt(byte, 16)).buffer
      },
    },
  }
}

test('checks the HIBP hash range without sending the password or its full hash', async () => {
  const requests = []
  const pwned = await isPasswordPwned('password', {
    cryptoImpl: cryptoForHash(leakedPasswordHash),
    fetchImpl: async (url, options) => {
      requests.push({ url, options })
      return { ok: true, text: async () => `${leakedPasswordHash.slice(5)}:123456\r\nOTHER:1` }
    },
  })

  assert.equal(pwned, true)
  assert.equal(requests[0].url, 'https://api.pwnedpasswords.com/range/5BAA6')
  assert.equal(requests[0].options.headers['Add-Padding'], 'true')
  assert.equal(requests[0].url.includes(leakedPasswordHash), false)
  assert.equal(requests[0].options.body, undefined)
})

test('accepts a password absent from the returned hash range', async () => {
  const pwned = await isPasswordPwned('password', {
    cryptoImpl: cryptoForHash(leakedPasswordHash),
    fetchImpl: async () => ({ ok: true, text: async () => 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA:3\r\n' }),
  })

  assert.equal(pwned, false)
})

test('fails closed with a clear error when the range API is unavailable', async () => {
  await assert.rejects(
    isPasswordPwned('password', {
      cryptoImpl: cryptoForHash(leakedPasswordHash),
      fetchImpl: async () => ({ ok: false, status: 503 }),
    }),
    /Could not check this password against known data breaches/,
  )
})
