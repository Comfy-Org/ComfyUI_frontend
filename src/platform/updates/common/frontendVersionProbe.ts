/**
 * Shared probe for the desired frontend version served by the edge.
 *
 * A cheap `HEAD /` reads the `X-Frontend-Version` (and `X-Frontend-Bucket`)
 * response headers that nginx injects. That value is the *desired* version the
 * edge currently serves; the running bundle's version is
 * `__COMFYUI_FRONTEND_COMMIT__`. Comparing the two is the drift check used both
 * for RUM canary tagging and for the soft "new version available" reload prompt.
 */

const FRONTEND_VERSION_PROBE_TIMEOUT_MS = 1_000

export interface FrontendVersionProbeResult {
  /** Value of the `X-Frontend-Version` header, or `null` when absent. */
  version: string | null
  /** Value of the `X-Frontend-Bucket` header, or `null` when absent. */
  bucket: string | null
}

/**
 * Issues a `HEAD /` request against the current origin and reads the
 * frontend-version headers. Returns `null` when the probe response is not OK,
 * so callers can treat an unreachable edge the same as "no signal".
 *
 * Never throws for network/timeout errors is *not* guaranteed here — callers
 * that must not surface failures should wrap the call (e.g. `.catch(() => {})`),
 * matching the existing RUM initialization behavior.
 */
export async function probeFrontendVersion(
  timeoutMs: number = FRONTEND_VERSION_PROBE_TIMEOUT_MS
): Promise<FrontendVersionProbeResult | null> {
  const response = await fetch(window.location.origin, {
    method: 'HEAD',
    cache: 'no-store',
    signal: AbortSignal.timeout(timeoutMs)
  })
  if (!response.ok) return null

  return {
    version: response.headers.get('X-Frontend-Version'),
    bucket: response.headers.get('X-Frontend-Bucket')
  }
}
