/**
 * Probe the configured ComfyUI backend (local or remote-via-localStorage)
 * to confirm it serves the expected `/api/system_stats` shape. Used by the
 * router to decide whether to enter GraphView or redirect to /connect.
 */

const BACKEND_URL_KEY = 'comfyui-preview-backend-url'
const PROBE_TIMEOUT_MS = 3000

export async function isBackendReachable(): Promise<boolean> {
  const backendUrl = localStorage.getItem(BACKEND_URL_KEY) || ''
  const apiBase = backendUrl.replace(/\/+$/, '')

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
