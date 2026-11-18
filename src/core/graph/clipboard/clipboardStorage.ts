import { reportError } from '@comfyorg/telemetry/reportError'

export const CANVAS_CLIPBOARD_KEY = 'litegrapheditor_clipboard'
export const CANVAS_CLIPBOARD_ID_KEY = 'litegrapheditor_clipboard_id'

const invalidationPrefix = `${CANVAS_CLIPBOARD_KEY}:invalid:`
const locallyDiscarded = new Map<string, string>()

function invalidationFor(serialized: string): { key: string; value: string } {
  try {
    const payload: unknown = JSON.parse(serialized)
    if (
      typeof payload === 'object' &&
      payload !== null &&
      'clipboardId' in payload &&
      typeof payload.clipboardId === 'string'
    ) {
      return {
        key: `${invalidationPrefix}id:${payload.clipboardId}`,
        value: '1'
      }
    }
  } catch {
    return { key: `${invalidationPrefix}legacy`, value: serialized }
  }
  return { key: `${invalidationPrefix}legacy`, value: serialized }
}

function reportStorageError(error: unknown): void {
  if (
    error instanceof DOMException &&
    (error.name === 'QuotaExceededError' || error.name === 'SecurityError')
  )
    return
  reportError(error, {
    errorType: 'error_writing_clipboard_storage',
    surface: 'graph'
  })
}

/** Invalidates only this copy, without deleting the shared payload. */
export function discardClipboardStorage(serialized: string): void {
  const { key, value } = invalidationFor(serialized)
  locallyDiscarded.set(key, value)
  try {
    if (localStorage.getItem(CANVAS_CLIPBOARD_KEY) !== serialized) {
      locallyDiscarded.delete(key)
      return
    }
    localStorage.setItem(key, value)
  } catch (error) {
    reportStorageError(error)
  }
}

/** Reads the usable cache, or undefined when storage is inaccessible. */
export function readClipboardStorage(): string | null | undefined {
  try {
    const serialized = localStorage.getItem(CANVAS_CLIPBOARD_KEY)
    if (serialized === null) return null
    const { key, value } = invalidationFor(serialized)
    if (
      locallyDiscarded.get(key) === value ||
      localStorage.getItem(key) === value
    )
      return null
    return serialized
  } catch (error) {
    if (!(error instanceof DOMException && error.name === 'SecurityError')) {
      reportError(error, {
        errorType: 'error_reading_clipboard_storage',
        surface: 'graph'
      })
    }
    return undefined
  }
}

export function writeClipboardStorage(serialized: string): boolean {
  let previous: string | null | undefined
  try {
    previous = localStorage.getItem(CANVAS_CLIPBOARD_KEY)
    localStorage.setItem(CANVAS_CLIPBOARD_KEY, serialized)
  } catch (error) {
    if (previous) discardClipboardStorage(previous)
    reportStorageError(error)
    return false
  }
  if (previous) {
    const { key } = invalidationFor(previous)
    locallyDiscarded.delete(key)
    try {
      localStorage.removeItem(key)
    } catch {
      return true
    }
  }
  return true
}
