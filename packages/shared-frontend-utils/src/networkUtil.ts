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

/** Bounds every probe leg; two previously had none. */
const PROBE_TIMEOUT_MS = 2000

/** Baidu answering this fast implies a China route. */
const CHINA_LATENCY_MS = 150

/**
 * The abort signal alone is not enough: a request the browser never resolves
 * nor rejects would hang forever, so the deadline rejects independently.
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

const probe = (url: string) =>
  fetchWithin(url, { mode: 'no-cors', cache: 'no-cache' })

/**
 * A best-effort UX hint, unsound both ways: a VPN user in China reaches Google,
 * and a `zh-CN` user anywhere is blocked whenever Google is briefly
 * unreachable. Every leg is bounded, so this always settles — callers must not
 * add a timeout that could pre-empt a slow but real answer.
 */
export async function isInChina(): Promise<boolean> {
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
