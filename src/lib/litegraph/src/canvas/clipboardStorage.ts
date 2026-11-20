import { reportError } from '@comfyorg/telemetry/reportError'

import { safeLocalStorage } from '@/base/storage/safeStorage'
import { createUuidv4 } from '@/utils/uuid'

export const CANVAS_CLIPBOARD_KEY = 'litegrapheditor_clipboard'
export const CANVAS_CLIPBOARD_ID_KEY = 'litegrapheditor_clipboard_id'

function isExpectedStorageError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === 'QuotaExceededError' || error.name === 'SecurityError')
  )
}

function discardClipboardId(): void {
  safeLocalStorage.removeItem(CANVAS_CLIPBOARD_ID_KEY)
}

/** Drops the cached payload and its stamp. Never throws. */
export function discardClipboardStorage(): void {
  safeLocalStorage.removeItem(CANVAS_CLIPBOARD_KEY)
  safeLocalStorage.removeItem(CANVAS_CLIPBOARD_ID_KEY)
}

/** Reads the copy stamp, or `null` when storage is unreadable. Never throws. */
export function readClipboardId(): string | null {
  return safeLocalStorage.getItem(CANVAS_CLIPBOARD_ID_KEY)
}

function reportStorageError(error: unknown): void {
  if (isExpectedStorageError(error)) return
  reportError(error, {
    errorType: 'error_writing_clipboard_storage',
    surface: 'graph'
  })
}

export function writeClipboardStorage(serializedData: string): boolean {
  const payloadWrite = safeLocalStorage.write(
    CANVAS_CLIPBOARD_KEY,
    serializedData
  )
  if (payloadWrite.result !== 'ok') {
    discardClipboardStorage()
    reportStorageError(payloadWrite.error)
    return false
  }
  try {
    const stampWrite = safeLocalStorage.write(
      CANVAS_CLIPBOARD_ID_KEY,
      createUuidv4()
    )
    if (stampWrite.result !== 'ok') {
      discardClipboardId()
      reportStorageError(stampWrite.error)
    }
  } catch (error) {
    discardClipboardId()
    reportStorageError(error)
  }
  return true
}
