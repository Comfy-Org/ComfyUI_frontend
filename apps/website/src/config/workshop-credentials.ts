/**
 * Where the credential for a run comes from.
 *
 * Today: a Comfy API key the visitor pastes in, held in `localStorage` so it
 * survives a reload. comfy.org has no signed-in session yet — the origin is
 * not on the Firebase authorized-domains list, so a sign-in popup there fails
 * before it starts. Once that lands, a session token becomes a second source
 * behind this same function and the key stays as the fallback developers
 * asked for anyway.
 *
 * `localStorage`, not a cookie: nothing on comfy.org is server-rendered, so
 * a cookie would be sent on every asset request for no reason and would be
 * readable by anything on the origin either way.
 */

const STORAGE_KEY = 'comfy.workshop.apiKey'

/**
 * Deliberately not validated against a `comfyui-` prefix. Router accepts an
 * API key or a Firebase JWT in the same slot and the SDK checks neither, so
 * a format guess here could only ever reject a credential that works.
 */
export function readStoredCredentials(): string {
  try {
    return globalThis.localStorage?.getItem(STORAGE_KEY) ?? ''
  } catch {
    // Storage can throw outright when the origin has cookies disabled.
    return ''
  }
}

export function writeStoredCredentials(credentials: string): void {
  try {
    if (credentials === '') {
      globalThis.localStorage?.removeItem(STORAGE_KEY)
      return
    }
    globalThis.localStorage?.setItem(STORAGE_KEY, credentials)
  } catch {
    // A run works fine without the key surviving a reload.
  }
}
