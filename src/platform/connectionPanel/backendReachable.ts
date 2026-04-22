/**
 * Probe the configured ComfyUI backend (local or remote-via-localStorage)
 * to confirm it serves the expected `/api/system_stats` shape. Used by the
 * router to decide whether to enter GraphView or redirect to /connect.
 */

const BACKEND_URL_KEY = 'comfyui-preview-backend-url'
const PROBE_TIMEOUT_MS = 3000

function resolveProbeBase(): string {
  const stored = localStorage.getItem(BACKEND_URL_KEY)
  if (stored) {
    try {
      // Only treat the stored value as a backend override when it's a
      // well-formed absolute URL — otherwise fall through to same-origin.
      const url = new URL(stored)
      return url.origin + url.pathname.replace(/\/+$/, '')
    } catch {
      // Ignore malformed entries; same-origin probe is safer than a
      // relative URL that misses the router's subpath base.
    }
  }
  // Mirror ComfyApi's same-origin base so subpath deployments probe the
  // backend that would actually serve the app.
  if (typeof window === 'undefined') return ''
  return window.location.pathname.split('/').slice(0, -1).join('/')
}

export async function isBackendReachable(): Promise<boolean> {
  const apiBase = resolveProbeBase()

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS)

  try {
    const res = await fetch(`${apiBase}/api/system_stats`, {
      signal: controller.signal
    })
    if (!res.ok) return false
    const body = (await res.json()) as { system?: unknown }
    return !!body.system
  } catch {
    return false
  } finally {
    clearTimeout(timeout)
  }
}
