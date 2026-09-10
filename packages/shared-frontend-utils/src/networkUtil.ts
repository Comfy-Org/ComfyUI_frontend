import axios from 'axios'

const VALID_STATUS_CODES = [200, 201, 301, 302, 307, 308]
export const checkUrlReachable = async (url: string): Promise<boolean> => {
  try {
    const response = await axios.head(url)
    return VALID_STATUS_CODES.includes(response.status)
  } catch {
    return false
  }
}

/**
 * A CDN implementation detail, not a contract we own. The durable form is a
 * first-party endpoint echoing `CF-IPCountry`.
 */
const CLIENT_COUNTRY_URL = 'https://cloud.comfy.org/cdn-cgi/trace'

/** Bounds every probe leg; two previously had none. */
const PROBE_TIMEOUT_MS = 2000

/** Baidu answering this fast implies a China route. */
const CHINA_LATENCY_MS = 150

/** `XX` is an unknown country and `T1` is Tor: neither names where the client is. */
const UNRESOLVED_COUNTRIES = new Set(['XX', 'T1'])

const parseTraceCountry = (body: string): string | undefined => {
  const country =
    body
      .split('\n')
      .find((line) => line.startsWith('loc='))
      ?.slice('loc='.length)
      .trim()
      .toUpperCase() || undefined

  return country && UNRESOLVED_COUNTRIES.has(country) ? undefined : country
}

/**
 * The abort signal alone is not enough: a request the browser never resolves
 * nor rejects would hang forever, so the deadline rejects independently.
 *
 * `read` runs inside the deadline so a response that sends headers and then
 * stalls its body is bounded too.
 */
async function fetchWithin<T>(
  url: string,
  init: RequestInit,
  read: (response: Response) => Promise<T>
): Promise<T> {
  const controller = new AbortController()
  let expire: ReturnType<typeof setTimeout> | undefined

  const deadline = new Promise<never>((_, reject) => {
    expire = setTimeout(() => {
      controller.abort()
      reject(new Error(`Timed out after ${PROBE_TIMEOUT_MS}ms: ${url}`))
    }, PROBE_TIMEOUT_MS)
  })

  try {
    return await Promise.race([
      fetch(url, { ...init, signal: controller.signal }).then(read),
      deadline
    ])
  } finally {
    clearTimeout(expire)
  }
}

/** ISO country from the CDN edge, or `undefined` when it cannot answer. */
export async function getClientCountry(): Promise<string | undefined> {
  try {
    const body = await fetchWithin(
      CLIENT_COUNTRY_URL,
      { cache: 'no-store' },
      async (response) => (response.ok ? response.text() : undefined)
    )
    return body === undefined ? undefined : parseTraceCountry(body)
  } catch {
    return undefined
  }
}

const probe = (url: string) =>
  fetchWithin(url, { mode: 'no-cors', cache: 'no-cache' }, async () => {})

/**
 * Fallback for when the edge cannot answer. Unsound both ways: a VPN user in
 * China reaches Google, and a `zh-CN` user anywhere is blocked whenever Google
 * is briefly unreachable.
 */
async function isInChinaByProbe(): Promise<boolean> {
  const isChineseLocale = navigator.language.toLowerCase().startsWith('zh-cn')

  try {
    await probe('https://www.google.com')
    return false
  } catch {
    if (isChineseLocale) return true

    try {
      const start = performance.now()
      await probe('https://www.baidu.com')
      return performance.now() - start < CHINA_LATENCY_MS
    } catch {
      return isChineseLocale
    }
  }
}

/**
 * Prefers the edge's geo-IP, falling back to the heuristic. Always settles, so
 * callers must not add a timeout that could pre-empt a slow but real answer.
 */
export async function isInChina(): Promise<boolean> {
  const country = await getClientCountry()
  if (country !== undefined) return country === 'CN'

  return isInChinaByProbe()
}
