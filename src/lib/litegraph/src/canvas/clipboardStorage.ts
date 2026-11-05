export const CANVAS_CLIPBOARD_KEY = 'litegrapheditor_clipboard'
export const CANVAS_CLIPBOARD_ID_KEY = 'litegrapheditor_clipboard_id'

/** True for the storage-is-full `DOMException`, an expected outcome of a large copy. */
export function isQuotaExceededError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'QuotaExceededError'
}

/**
 * Drops the canvas clipboard cache. Never throws, so it is safe to call while
 * handling a storage error - `localStorage` itself throws on every access when
 * site storage is blocked.
 */
export function discardClipboardStorage(): void {
  for (const key of [CANVAS_CLIPBOARD_KEY, CANVAS_CLIPBOARD_ID_KEY]) {
    try {
      localStorage.removeItem(key)
    } catch {
      // Storage is unreachable; the system clipboard write is the one that counts.
    }
  }
}
