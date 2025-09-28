/**
 * Whitelisting helper for enabling SSO on safe, local-only hosts.
 *
 * Built-ins (always allowed):
 *   • 'localhost' and any subdomain of '.localhost' (e.g., app.localhost)
 *   • IPv4 loopback 127.0.0.0/8 (e.g., 127.0.0.1, 127.1.2.3)
 *   • IPv6 loopback ::1 (supports compressed/expanded textual forms)
 *
 * No environment variables are used. To add more exact hostnames,
 * edit HOST_WHITELIST below.
 */

const HOST_WHITELIST: string[] = ['localhost']

/** Normalize for comparison: lowercase, strip port/brackets, trim trailing dot. */
export function normalizeHost(input: string): string {
  let h = (input || '').trim().toLowerCase()

  // Trim a trailing dot: 'localhost.' -> 'localhost'
  h = h.replace(/\.$/, '')

  // Remove ':port' safely.
  // Case 1: [IPv6]:port
  const mBracket = h.match(/^\[([^\]]+)\]:(\d+)$/)
  if (mBracket) {
    h = mBracket[1] // keep only the host inside the brackets
  } else {
    // Case 2: hostname/IPv4:port (exactly one ':')
    const mPort = h.match(/^([^:]+):(\d+)$/)
    if (mPort) h = mPort[1]
  }

  // Strip any remaining brackets (e.g., '[::1]' -> '::1')
  h = h.replace(/^\[|\]$/g, '')

  return h
}

/** Public check used by the UI. */
export function isHostWhitelisted(rawHost: string): boolean {
  const host = normalizeHost(rawHost)
  if (isLocalhostLabel(host)) return true
  if (isIPv4Loopback(host)) return true
  if (isIPv6Loopback(host)) return true
  const normalizedList = HOST_WHITELIST.map(normalizeHost)
  return normalizedList.includes(host)
}

/* -------------------- Helpers -------------------- */

function isLocalhostLabel(h: string): boolean {
  // 'localhost' and any subdomain (e.g., 'app.localhost')
  return h === 'localhost' || h.endsWith('.localhost')
}

function isIPv4Loopback(h: string): boolean {
  // 127/8: 127.x.y.z
  const parts = h.split('.')
  if (parts.length !== 4) return false
  if (!parts.every((p) => /^\d{1,3}$/.test(p))) return false
  const nums = parts.map((n) => parseInt(n, 10))
  if (nums.some((n) => n < 0 || n > 255)) return false
  return nums[0] === 127
}

function isIPv6Loopback(h: string): boolean {
  if (h === '::1') return true

  // Fully expanded form: 0:0:0:0:0:0:0:1 (allow leading zeros)
  const segs = h.split(':')
  if (segs.length === 8 && segs.every(validHexSeg)) {
    return segs.slice(0, 7).every(zeroSeg) && isOne(segs[7])
  }

  // Compressed (::) forms still equal to ::1 (e.g., ::0001, 0:0::1, etc.)
  if (h.includes('::')) {
    const [lhs, rhs] = h.split('::')
    const leftSegs = lhs ? lhs.split(':').filter(Boolean) : []
    const rightSegs = rhs ? rhs.split(':').filter(Boolean) : []
    if (![...leftSegs, ...rightSegs].every(validHexSeg)) return false
    const missing = 8 - (leftSegs.length + rightSegs.length)
    if (missing < 1) return false // '::' must compress at least one zero group
    const expanded = [...leftSegs, ...Array(missing).fill('0'), ...rightSegs]
    return expanded.slice(0, 7).every(zeroSeg) && isOne(expanded[7])
  }

  return false
}

function validHexSeg(s: string): boolean {
  return s.length > 0 && s.length <= 4 && /^[0-9a-f]+$/i.test(s)
}
function zeroSeg(s: string): boolean {
  return parseInt(s || '0', 16) === 0
}
function isOne(s: string): boolean {
  return parseInt(s || '0', 16) === 1
}
