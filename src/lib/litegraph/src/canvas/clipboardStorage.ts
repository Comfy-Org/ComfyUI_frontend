export const CANVAS_CLIPBOARD_KEY = 'litegrapheditor_clipboard'
export const CANVAS_CLIPBOARD_ID_KEY = 'litegrapheditor_clipboard_id'

/**
 * True for the storage-is-full `DOMException`. A large selection can serialise
 * to megabytes, so this is an expected outcome of an ordinary copy rather than
 * a defect, and it is reported as noise if treated like one.
 */
export function isQuotaExceededError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'QuotaExceededError'
}

/**
 * Drops the canvas clipboard cache, tolerating a `localStorage` that throws on
 * every access (Firefox does this when site storage is blocked).
 *
 * Callers rely on this never throwing. A cache left half-written is worse than
 * an absent one: the paste paths that read storage directly cannot tell a stale
 * entry from a current one, so they would paste the previous selection.
 */
export function discardClipboardStorage(): void {
  for (const key of [CANVAS_CLIPBOARD_KEY, CANVAS_CLIPBOARD_ID_KEY]) {
    try {
      localStorage.removeItem(key)
    } catch {
      // Storage is unreachable, so there is nothing we can do and nothing the
      // user needs to know: the system clipboard write is the one that counts.
    }
  }
}
