/**
 * Bridges the auth -> canvas gap for the `canvas_ready` activation event.
 *
 * The onboarded path navigates with a full `location.href` reload, which wipes
 * in-memory state (including the auth store) before the graph canvas mounts.
 * `auth_completed` therefore cannot carry forward whether the user was new or
 * when they authenticated. We stash a small marker in `sessionStorage` at auth
 * completion and consume it exactly once when the canvas first becomes
 * interactive. sessionStorage is per-tab and cleared on tab close, which is the
 * correct scope for a single activation.
 */
const MARKER_KEY = 'comfy:telemetry:auth-activation'

// Auth -> canvas is seconds; a marker older than this was left by an aborted
// flow and a later unrelated reload would report a bogus ms_since_auth.
const MAX_MARKER_AGE_MS = 60_000

interface AuthActivationMarker {
  at: number
  isNewUser: boolean
}

/** Records that an authentication just completed, for the next canvas load. */
export function markAuthForActivation(isNewUser: boolean): void {
  try {
    const marker: AuthActivationMarker = { at: Date.now(), isNewUser }
    sessionStorage.setItem(MARKER_KEY, JSON.stringify(marker))
  } catch {
    // sessionStorage may be unavailable (private mode, SSR); skip silently.
  }
}

/**
 * Reads and clears the activation marker. Returns null when no auth happened in
 * this tab (e.g. a plain reload by a returning user).
 */
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
      // Drop a stale marker so an unrelated later reload doesn't report a bogus
      // ms_since_auth (canvas_ready then omits the latency).
      if (Date.now() - marker.at <= MAX_MARKER_AGE_MS) return marker
    }
  } catch {
    // Corrupt or unavailable; treat as no marker.
  }
  return null
}
