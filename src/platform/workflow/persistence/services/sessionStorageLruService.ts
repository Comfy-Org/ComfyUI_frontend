/**
 * @fileoverview LRU-based session storage service with automatic eviction
 * @module services/sessionStorageLruService
 *
 * Provides session storage operations with:
 * - LRU tracking via embedded timestamps
 * - Automatic eviction on quota exceeded errors
 * - Graceful degradation when storage is unavailable
 * - Backward compatibility with legacy (unwrapped) data
 *
 * @deprecated-notice Legacy format support (unwrapped data) can be removed after 2026-07-15
 */

interface StorageEntry<T> {
  accessedAt: number
  data: T
}

interface EvictableEntry {
  key: string
  accessedAt: number
  size: number
}

const MAX_EVICTION_ATTEMPTS = 3
const PROTECTED_KEY_PREFIXES = ['workspace.', 'Workspace.']

function isProtectedKey(key: string): boolean {
  return PROTECTED_KEY_PREFIXES.some((prefix) => key.includes(prefix))
}

/**
 * Checks if parsed data is in legacy format (raw data without wrapper)
 * Legacy format: raw workflow JSON with nodes/links at top level
 * New format: { accessedAt: number, data: T }
 *
 * @deprecated Remove after 2026-07-15
 */
function isLegacyFormat(parsed: unknown): boolean {
  if (typeof parsed !== 'object' || parsed === null) return true
  const obj = parsed as Record<string, unknown>
  return !('accessedAt' in obj && 'data' in obj)
}

/**
 * Wraps data with LRU metadata for storage
 */
function wrapForStorage<T>(data: T): string {
  const entry: StorageEntry<T> = {
    accessedAt: Date.now(),
    data
  }
  return JSON.stringify(entry)
}

/**
 * Unwraps stored data, handling both legacy and new formats
 * Legacy entries are assigned accessedAt: 0 to prioritize them for eviction
 *
 * @deprecated Legacy handling can be removed after 2026-07-15
 */
function unwrapFromStorage<T>(raw: string): StorageEntry<T> {
  const parsed = JSON.parse(raw)

  if (isLegacyFormat(parsed)) {
    return {
      accessedAt: 0,
      data: parsed as T
    }
  }

  return parsed as StorageEntry<T>
}

/**
 * Gets all evictable entries from session storage matching a key pattern
 */
function getEvictableEntries(keyPattern: RegExp): EvictableEntry[] {
  const entries: EvictableEntry[] = []

  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i)
    if (!key || !keyPattern.test(key) || isProtectedKey(key)) continue

    const raw = sessionStorage.getItem(key)
    if (!raw) continue

    try {
      const entry = unwrapFromStorage(raw)
      entries.push({
        key,
        accessedAt: entry.accessedAt,
        size: raw.length
      })
    } catch {
      entries.push({
        key,
        accessedAt: 0,
        size: raw.length
      })
    }
  }

  return entries
}

/**
 * Evicts the least recently used entries matching a pattern
 * @returns Number of bytes freed
 */
function evictLruEntries(
  keyPattern: RegExp,
  excludeKey?: string,
  maxToEvict: number = 1
): number {
  const entries = getEvictableEntries(keyPattern)
    .filter((e) => e.key !== excludeKey)
    .sort((a, b) => a.accessedAt - b.accessedAt)

  let freedBytes = 0
  const toEvict = entries.slice(0, maxToEvict)

  for (const entry of toEvict) {
    sessionStorage.removeItem(entry.key)
    freedBytes += entry.size
  }

  if (toEvict.length > 0) {
    console.warn(
      `[SessionStorageLRU] Evicted ${toEvict.length} entries, freed ~${Math.round(freedBytes / 1024)}KB`,
      toEvict.map((e) => e.key)
    )
  }

  return freedBytes
}

/**
 * Attempts to set a session storage item with LRU eviction on quota exceeded
 *
 * @param key - Storage key
 * @param data - Data to store (will be wrapped with LRU metadata)
 * @param evictionPattern - Regex pattern for keys eligible for eviction
 * @returns true if stored successfully, false if storage failed after retries
 */
export function setWithLruEviction<T>(
  key: string,
  data: T,
  evictionPattern: RegExp = /^workflow:/
): boolean {
  const wrapped = wrapForStorage(data)

  for (let attempt = 0; attempt <= MAX_EVICTION_ATTEMPTS; attempt++) {
    try {
      sessionStorage.setItem(key, wrapped)
      return true
    } catch (error) {
      if (
        !(error instanceof DOMException) ||
        error.name !== 'QuotaExceededError'
      ) {
        console.error('[SessionStorageLRU] Unexpected storage error:', error)
        return false
      }

      if (attempt === MAX_EVICTION_ATTEMPTS) {
        console.warn(
          `[SessionStorageLRU] Failed to store ${key} after ${MAX_EVICTION_ATTEMPTS} eviction attempts`
        )
        return false
      }

      const entriesToEvict = Math.min(attempt + 1, 3)
      const freedBytes = evictLruEntries(evictionPattern, key, entriesToEvict)

      if (freedBytes === 0) {
        console.warn(
          '[SessionStorageLRU] No entries available for eviction, giving up'
        )
        return false
      }
    }
  }

  return false
}

/**
 * Gets data from session storage, updating access time for LRU tracking
 *
 * @param key - Storage key
 * @param updateAccessTime - Whether to update the access timestamp (default: true)
 * @returns The stored data, or null if not found
 */
export function getWithLruTracking<T>(
  key: string,
  updateAccessTime: boolean = true
): T | null {
  const raw = sessionStorage.getItem(key)
  if (!raw) return null

  try {
    const entry = unwrapFromStorage<T>(raw)

    if (updateAccessTime && entry.accessedAt !== Date.now()) {
      try {
        sessionStorage.setItem(key, wrapForStorage(entry.data))
      } catch {
        // Ignore quota errors when updating access time
      }
    }

    return entry.data
  } catch (error) {
    console.warn(`[SessionStorageLRU] Failed to parse ${key}:`, error)
    return null
  }
}

/**
 * Removes an item from session storage
 */
export function removeFromStorage(key: string): void {
  sessionStorage.removeItem(key)
}

/**
 * Gets storage statistics for debugging
 */
export function getStorageStats(keyPattern?: RegExp): {
  totalItems: number
  matchingItems: number
  totalSizeKB: number
  matchingSizeKB: number
  entries: Array<{ key: string; sizeKB: number; accessedAt: number }>
} {
  let totalSize = 0
  let matchingSize = 0
  let matchingItems = 0
  const entries: Array<{ key: string; sizeKB: number; accessedAt: number }> = []

  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i)
    if (!key) continue

    const raw = sessionStorage.getItem(key)
    if (!raw) continue

    const size = raw.length * 2
    totalSize += size

    if (!keyPattern || keyPattern.test(key)) {
      matchingItems++
      matchingSize += size

      try {
        const entry = unwrapFromStorage(raw)
        entries.push({
          key,
          sizeKB: Math.round(size / 1024),
          accessedAt: entry.accessedAt
        })
      } catch {
        entries.push({
          key,
          sizeKB: Math.round(size / 1024),
          accessedAt: 0
        })
      }
    }
  }

  return {
    totalItems: sessionStorage.length,
    matchingItems,
    totalSizeKB: Math.round(totalSize / 1024),
    matchingSizeKB: Math.round(matchingSize / 1024),
    entries: entries.sort((a, b) => a.accessedAt - b.accessedAt)
  }
}
