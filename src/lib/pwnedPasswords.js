const RANGE_API = 'https://api.pwnedpasswords.com/range/'

export async function isPasswordPwned(password, {
  fetchImpl = globalThis.fetch,
  cryptoImpl = globalThis.crypto,
} = {}) {
  if (!cryptoImpl?.subtle || typeof fetchImpl !== 'function') {
    throw new Error('Leaked-password checking is unavailable in this browser.')
  }

  const digest = await cryptoImpl.subtle.digest('SHA-1', new TextEncoder().encode(password))
  const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('').toUpperCase()
  const prefix = hash.slice(0, 5)
  const suffix = hash.slice(5)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)
  let ranges
  try {
    const response = await fetchImpl(`${RANGE_API}${prefix}`, {
      headers: { 'Add-Padding': 'true' },
      signal: controller.signal,
    })
    if (!response.ok) {
      throw new Error('Could not check this password against known data breaches. Please try again.')
    }
    ranges = await response.text()
  } catch {
    throw new Error('Could not check this password against known data breaches. Please try again.')
  } finally {
    clearTimeout(timeout)
  }

  return ranges.split(/\r?\n/).some((line) => {
    const [candidate] = line.split(':')
    return candidate?.toUpperCase() === suffix
  })
}
