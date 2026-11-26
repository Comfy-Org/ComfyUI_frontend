import { reportError } from '@comfyorg/telemetry/reportError'

import { safeLocalStorage } from '@comfyorg/shared-frontend-utils/safeStorage'

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
  const current = safeLocalStorage.read(CANVAS_CLIPBOARD_KEY)
  if (!current.ok) {
    reportStorageError(current.error)
    return
  }
  if (current.value !== serialized) {
    locallyDiscarded.delete(key)
    return
  }
  const marked = safeLocalStorage.write(key, value)
  if (marked.result !== 'ok') reportStorageError(marked.error)
}

function reportReadError(error: unknown): void {
  if (error instanceof DOMException && error.name === 'SecurityError') return
  reportError(error, {
    errorType: 'error_reading_clipboard_storage',
    surface: 'graph'
  })
}

/** Reads the usable cache, or undefined when storage is inaccessible. */
export function readClipboardStorage(): string | null | undefined {
  const payload = safeLocalStorage.read(CANVAS_CLIPBOARD_KEY)
  if (!payload.ok) {
    reportReadError(payload.error)
    return undefined
  }
  const serialized = payload.value
  if (serialized === null) return null
  const { key, value } = invalidationFor(serialized)
  if (locallyDiscarded.get(key) === value) return null
  const marker = safeLocalStorage.read(key)
  if (!marker.ok) {
    reportReadError(marker.error)
    return undefined
  }
  return marker.value === value ? null : serialized
}

export function writeClipboardStorage(serialized: string): boolean {
  const previous = safeLocalStorage.read(CANVAS_CLIPBOARD_KEY)
  if (!previous.ok) {
    reportStorageError(previous.error)
    return false
  }
  const written = safeLocalStorage.write(CANVAS_CLIPBOARD_KEY, serialized)
  if (written.result !== 'ok') {
    if (previous.value) discardClipboardStorage(previous.value)
    reportStorageError(written.error)
    return false
  }
  if (previous.value) {
    const { key } = invalidationFor(previous.value)
    locallyDiscarded.delete(key)
    safeLocalStorage.remove(key)
  }
  return true
}
