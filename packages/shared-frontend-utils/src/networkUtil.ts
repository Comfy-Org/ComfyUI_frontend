import axios from 'axios'

const VALID_STATUS_CODES = [200, 201, 301, 302, 307, 308]
export const checkUrlReachable = async (url: string): Promise<boolean> => {
  try {
    const response = await axios.head(url)
    // Additional check for successful response
    return VALID_STATUS_CODES.includes(response.status)
  } catch {
    return false
  }
}

/**
 * Cloudflare's edge echoes the request's geo-IP country here. It is an
 * implementation detail of our CDN rather than a contract we own; the durable
 * form is a first-party endpoint echoing the `CF-IPCountry` header.
 */
const CLIENT_COUNTRY_URL = 'https://cloud.comfy.org/cdn-cgi/trace'

/** Pre-existing bound on the Google reachability probe, reused for every leg. */
const PROBE_TIMEOUT_MS = 2000

/** Pre-existing threshold: Baidu answering this fast implies a China route. */
const CHINA_LATENCY_MS = 150

const parseTraceCountry = (body: string): string | undefined =>
  body
    .split('\n')
    .find((line) => line.startsWith('loc='))
    ?.slice('loc='.length)
    .trim()
    .toUpperCase() || undefined

/**
 * Fetches with a deadline the caller controls. The abort signal alone is not
 * enough: a request the browser never resolves nor rejects would leave the
 * promise pending forever, so the deadline also rejects on its own.
 */
async function fetchWithin(url: string, init: RequestInit): Promise<Response> {
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
      fetch(url, { ...init, signal: controller.signal }),
      deadline
    ])
  } finally {
    clearTimeout(expire)
  }
}

/**
 * Resolves the client's ISO country code from the CDN edge, or `undefined` when
 * the edge cannot answer. One bounded request, no third-party pings.
 */
export async function getClientCountry(): Promise<string | undefined> {
  try {
    const response = await fetchWithin(CLIENT_COUNTRY_URL, {
      cache: 'no-store'
    })
    if (!response.ok) return undefined

    return parseTraceCountry(await response.text())
  } catch {
    return undefined
  }
}

const probe = (url: string) =>
  fetchWithin(url, { mode: 'no-cors', cache: 'no-cache' })

/**
 * Reachability heuristic used only when the edge cannot name the country.
 * Unsound in both directions — a VPN user in China reaches Google, and a
 * `zh-CN` user anywhere is blocked whenever Google is briefly unreachable.
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
 * Whether the client is in mainland China. Prefers the edge's geo-IP answer and
 * falls back to the reachability heuristic when the edge is unreachable.
 *
 * Every leg is bounded, so this always settles — callers must not add a timeout
 * of their own, which would pre-empt a slow but real answer.
 */
export async function isInChina(): Promise<boolean> {
  const country = await getClientCountry()
  if (country !== undefined) return country === 'CN'

  return isInChinaByProbe()
}
