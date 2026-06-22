// The onboarded path navigates via full location.href reload, wiping the auth
// store before the canvas mounts, so canvas_ready data is bridged through sessionStorage.
const MARKER_KEY = 'comfy:telemetry:auth-activation'

const MAX_MARKER_AGE_MS = 60_000

interface AuthActivationMarker {
  at: number
  isNewUser: boolean
}

export function markAuthForActivation(isNewUser: boolean): void {
  try {
    const marker: AuthActivationMarker = { at: Date.now(), isNewUser }
    sessionStorage.setItem(MARKER_KEY, JSON.stringify(marker))
  } catch {
    // sessionStorage unavailable (private mode, SSR).
  }
}

export function consumeAuthActivation(): AuthActivationMarker | null {
  try {
    const raw = sessionStorage.getItem(MARKER_KEY)
    if (!raw) return null
    sessionStorage.removeItem(MARKER_KEY)
    const parsed: unknown = JSON.parse(raw)
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof (parsed as AuthActivationMarker).at === 'number' &&
      typeof (parsed as AuthActivationMarker).isNewUser === 'boolean'
    ) {
      const marker = parsed as AuthActivationMarker
      // Drop a stale marker so an unrelated later reload doesn't report a bogus ms_since_auth.
      if (Date.now() - marker.at <= MAX_MARKER_AGE_MS) return marker
    }
  } catch {
    // Corrupt or unavailable; treat as no marker.
  }
  return null
}
