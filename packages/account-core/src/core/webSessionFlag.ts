/**
 * `unified_web_session` for a site with no sign-in of its own to ask with.
 * The anonymous `/api/features` document's global `web_session_probe` only
 * decides whether to ask; the answer is the credentialed read's
 * `unified_web_session` (cloud#10689). `web_session_probe` is a backend
 * follow-up to cloud#10689 and not served yet. Every failure is `false`.
 */
import { COMFY_CLIENT } from './requestAuth.js'

const DEFAULT_TIMEOUT_MS = 5000

export interface FeaturesReadOptions {
  /** Cloud origin, e.g. `https://cloud.comfy.org`. */
  readonly cloudBaseUrl: string
  readonly fetchImpl: typeof fetch
  readonly timeoutMs?: number
}

export interface UnifiedWebSessionOptions extends FeaturesReadOptions {
  /** Settles the anonymous document's `web_session_probe`. */
  readonly probe: () => Promise<boolean>
}

function readsLiteralTrue(body: unknown, key: string): boolean {
  return (
    typeof body === 'object' && body !== null && Reflect.get(body, key) === true
  )
}

async function readFeatures(
  {
    cloudBaseUrl,
    fetchImpl,
    timeoutMs = DEFAULT_TIMEOUT_MS
  }: FeaturesReadOptions,
  init: RequestInit
): Promise<unknown> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetchImpl(`${cloudBaseUrl}/api/features`, {
      ...init,
      signal: controller.signal
    })
    return response.ok ? await response.json() : undefined
  } catch {
    return undefined
  } finally {
    clearTimeout(timeout)
  }
}

/** A plain anonymous GET: no cookie, no custom header, so no CORS preflight. */
export async function readWebSessionProbe(
  options: FeaturesReadOptions
): Promise<boolean> {
  return readsLiteralTrue(await readFeatures(options, {}), 'web_session_probe')
}

async function probeIsOn(probe: () => Promise<boolean>): Promise<boolean> {
  try {
    return await probe()
  } catch {
    return false
  }
}

export async function resolveUnifiedWebSession({
  probe,
  ...options
}: UnifiedWebSessionOptions): Promise<boolean> {
  if (!(await probeIsOn(probe))) return false
  const body = await readFeatures(options, {
    credentials: 'include',
    cache: 'no-store',
    headers: { 'X-Comfy-Client': COMFY_CLIENT }
  })
  return readsLiteralTrue(body, 'unified_web_session')
}
