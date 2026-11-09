import { reportError } from '@comfyorg/telemetry/reportError'

import { createUuidv4 } from '@/utils/uuid'

export const CANVAS_CLIPBOARD_KEY = 'litegrapheditor_clipboard'
export const CANVAS_CLIPBOARD_ID_KEY = 'litegrapheditor_clipboard_id'

/** True for storage failures nobody can act on: the store is full, or blocked. */
export function isExpectedStorageError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === 'QuotaExceededError' || error.name === 'SecurityError')
  )
}

function removeQuietly(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    return
  }
}

/** Drops the copy stamp, leaving any cached payload in place. Never throws. */
export function discardClipboardId(): void {
  removeQuietly(CANVAS_CLIPBOARD_ID_KEY)
}

/** Drops the cached payload and its stamp. Never throws. */
export function discardClipboardStorage(): void {
  removeQuietly(CANVAS_CLIPBOARD_KEY)
  removeQuietly(CANVAS_CLIPBOARD_ID_KEY)
}

/** Reads the copy stamp, or `null` when storage is unreadable. Never throws. */
export function readClipboardId(): string | null {
  try {
    return localStorage.getItem(CANVAS_CLIPBOARD_ID_KEY)
  } catch {
    return null
  }
}

function reportStorageError(error: unknown): void {
  if (isExpectedStorageError(error)) return
  reportError(error, {
    errorType: 'error_writing_clipboard_storage',
    surface: 'graph'
  })
}

export function writeClipboardStorage(serializedData: string): boolean {
  try {
    localStorage.setItem(CANVAS_CLIPBOARD_KEY, serializedData)
  } catch (error) {
    discardClipboardStorage()
    reportStorageError(error)
    return false
  }
  try {
    localStorage.setItem(CANVAS_CLIPBOARD_ID_KEY, createUuidv4())
  } catch (error) {
    discardClipboardId()
    reportStorageError(error)
  }
  return true
}
