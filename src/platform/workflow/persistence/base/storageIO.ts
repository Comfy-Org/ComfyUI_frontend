/**
 * V2 Storage I/O - localStorage read/write with error handling.
 *
 * Handles quota management, orphan cleanup, and graceful degradation.
 */

import type {
  ActivePathPointer,
  DraftIndexV2,
  DraftPayloadV2,
  OpenPathsPointer
} from './draftTypes'
import { StorageKeys } from './storageKeys'

/** Flag indicating if storage is available */
let storageAvailable = true

export function isStorageAvailable(): boolean {
  return storageAvailable
}


export function markStorageUnavailable(): void {
  storageAvailable = false
}

function isQuotaExceeded(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === 'QuotaExceededError' ||
      error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      error.code === 22 ||
      error.code === 1014)
  )
}

function isValidIndex(value: unknown): value is DraftIndexV2 {
  if (typeof value !== 'object' || value === null) return false
  const obj = value as Record<string, unknown>
  return (
    obj.v === 2 &&
    typeof obj.updatedAt === 'number' &&
    Array.isArray(obj.order) &&
    typeof obj.entries === 'object' &&
    obj.entries !== null
  )
}

/**
 * Reads and parses the draft index from localStorage.
 */
export function readIndex(workspaceId: string): DraftIndexV2 | null {
  if (!storageAvailable) return null

  try {
    const key = StorageKeys.draftIndex(workspaceId)
    const json = localStorage.getItem(key)
    if (!json) return null

    const parsed = JSON.parse(json)
    if (!isValidIndex(parsed)) return null

    return parsed
  } catch {
    return null
  }
}

/**
 * Writes the draft index to localStorage.
 */
export function writeIndex(workspaceId: string, index: DraftIndexV2): boolean {
  if (!storageAvailable) return false

  try {
    const key = StorageKeys.draftIndex(workspaceId)
    localStorage.setItem(key, JSON.stringify(index))
    return true
  } catch (error) {
    if (isQuotaExceeded(error)) return false
    throw error
  }
}

/**
 * Reads a draft payload from localStorage.
 */
export function readPayload(
  workspaceId: string,
  draftKey: string
): DraftPayloadV2 | null {
  if (!storageAvailable) return null

  try {
    const key = `${StorageKeys.prefixes.draftPayload}${workspaceId}:${draftKey}`
    const json = localStorage.getItem(key)
    if (!json) return null

    return JSON.parse(json) as DraftPayloadV2
  } catch {
    return null
  }
}

/**
 * Writes a draft payload to localStorage.
 */
export function writePayload(
  workspaceId: string,
  draftKey: string,
  payload: DraftPayloadV2
): boolean {
  if (!storageAvailable) return false

  try {
    const key = `${StorageKeys.prefixes.draftPayload}${workspaceId}:${draftKey}`
    localStorage.setItem(key, JSON.stringify(payload))
    return true
  } catch (error) {
    if (isQuotaExceeded(error)) return false
    throw error
  }
}

/**
 * Deletes a draft payload from localStorage.
 */
export function deletePayload(workspaceId: string, draftKey: string): void {
  try {
    const key = `${StorageKeys.prefixes.draftPayload}${workspaceId}:${draftKey}`
    localStorage.removeItem(key)
  } catch {
    // Ignore errors during deletion
  }
}

/**
 * Deletes multiple draft payloads from localStorage.
 */
export function deletePayloads(workspaceId: string, draftKeys: string[]): void {
  for (const draftKey of draftKeys) {
    deletePayload(workspaceId, draftKey)
  }
}

/**
 * Gets all draft payload keys for a workspace from localStorage.
 */
export function getPayloadKeys(workspaceId: string): string[] {
  if (!storageAvailable) return []

  const prefix = `${StorageKeys.prefixes.draftPayload}${workspaceId}:`
  const keys: string[] = []

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(prefix)) {
        keys.push(key.slice(prefix.length))
      }
    }
  } catch {
    return []
  }

  return keys
}

/**
 * Deletes orphan payloads that are not in the index.
 */
export function deleteOrphanPayloads(
  workspaceId: string,
  indexKeys: Set<string>
): number {
  const payloadKeys = getPayloadKeys(workspaceId)
  let deleted = 0

  for (const key of payloadKeys) {
    if (!indexKeys.has(key)) {
      deletePayload(workspaceId, key)
      deleted++
    }
  }

  return deleted
}

/**
 * Reads the active path pointer from sessionStorage.
 * If no pointer exists for the given clientId, searches for any pointer
 * matching the target workspaceId (handles clientId changes after reload).
 * When found via fallback, migrates the pointer to the new clientId key.
 */
export function readActivePath(
  clientId: string,
  targetWorkspaceId?: string
): ActivePathPointer | null {
  try {
    // Try exact clientId match first
    const key = StorageKeys.activePath(clientId)
    const json = sessionStorage.getItem(key)
    if (json) {
      return JSON.parse(json) as ActivePathPointer
    }

    // Fallback: search for any pointer matching the target workspace
    // This handles the case where clientId changed after page reload
    if (targetWorkspaceId) {
      const prefix = StorageKeys.prefixes.activePath
      for (let i = 0; i < sessionStorage.length; i++) {
        const storageKey = sessionStorage.key(i)
        if (storageKey?.startsWith(prefix) && storageKey !== key) {
          const pointerJson = sessionStorage.getItem(storageKey)
          if (pointerJson) {
            const pointer = JSON.parse(pointerJson) as ActivePathPointer
            if (pointer.workspaceId === targetWorkspaceId) {
              // Migrate to new clientId key and clean up old key
              sessionStorage.setItem(key, pointerJson)
              sessionStorage.removeItem(storageKey)
              return pointer
            }
          }
        }
      }
    }

    return null
  } catch {
    return null
  }
}

/**
 * Writes the active path pointer to sessionStorage.
 */
export function writeActivePath(
  clientId: string,
  pointer: ActivePathPointer
): void {
  try {
    const key = StorageKeys.activePath(clientId)
    sessionStorage.setItem(key, JSON.stringify(pointer))
  } catch {
    // Best effort - ignore errors
  }
}

/**
 * Reads the open paths pointer from sessionStorage.
 * If no pointer exists for the given clientId, searches for any pointer
 * matching the target workspaceId (handles clientId changes after reload).
 * When found via fallback, migrates the pointer to the new clientId key.
 */
export function readOpenPaths(
  clientId: string,
  targetWorkspaceId?: string
): OpenPathsPointer | null {
  try {
    // Try exact clientId match first
    const key = StorageKeys.openPaths(clientId)
    const json = sessionStorage.getItem(key)
    if (json) {
      return JSON.parse(json) as OpenPathsPointer
    }

    // Fallback: search for any pointer matching the target workspace
    // This handles the case where clientId changed after page reload
    if (targetWorkspaceId) {
      const prefix = StorageKeys.prefixes.openPaths
      for (let i = 0; i < sessionStorage.length; i++) {
        const storageKey = sessionStorage.key(i)
        if (storageKey?.startsWith(prefix) && storageKey !== key) {
          const pointerJson = sessionStorage.getItem(storageKey)
          if (pointerJson) {
            const pointer = JSON.parse(pointerJson) as OpenPathsPointer
            if (pointer.workspaceId === targetWorkspaceId) {
              // Migrate to new clientId key and clean up old key
              sessionStorage.setItem(key, pointerJson)
              sessionStorage.removeItem(storageKey)
              return pointer
            }
          }
        }
      }
    }

    return null
  } catch {
    return null
  }
}

/**
 * Writes the open paths pointer to sessionStorage.
 */
export function writeOpenPaths(
  clientId: string,
  pointer: OpenPathsPointer
): void {
  try {
    const key = StorageKeys.openPaths(clientId)
    sessionStorage.setItem(key, JSON.stringify(pointer))
  } catch {
    // Best effort - ignore errors
  }
}

/**
 * Clears all V2 workflow persistence data from storage.
 * Used during signout to prevent data leakage.
 */
export function clearAllV2Storage(): void {
  if (!storageAvailable) return

  const prefixes = [
    StorageKeys.prefixes.draftIndex,
    StorageKeys.prefixes.draftPayload
  ]

  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i)
      if (key && prefixes.some((prefix) => key.startsWith(prefix))) {
        try {
          localStorage.removeItem(key)
        } catch {
          // Ignore
        }
      }
    }
  } catch {
    // Ignore
  }

  const sessionPrefixes = [
    StorageKeys.prefixes.activePath,
    StorageKeys.prefixes.openPaths
  ]

  try {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const key = sessionStorage.key(i)
      if (key && sessionPrefixes.some((prefix) => key.startsWith(prefix))) {
        try {
          sessionStorage.removeItem(key)
        } catch {
          // Ignore
        }
      }
    }
  } catch {
    // Ignore
  }
}
