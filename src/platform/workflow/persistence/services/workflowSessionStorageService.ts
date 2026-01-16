/**
 * Session storage service for workflow data with automatic eviction on quota exceeded.
 * Uses timestamp-based access tracking to evict least recently used entries.
 */

interface StorageEntry<T> {
  accessedAt: number
  data: T
}

const MAX_EVICTION_ATTEMPTS = 3
const PROTECTED_KEY_PREFIXES = ['workspace.', 'Workspace.']

function isProtectedKey(key: string): boolean {
  return PROTECTED_KEY_PREFIXES.some((prefix) => key.startsWith(prefix))
}

/**
 * Legacy format: raw workflow JSON without wrapper.
 * @deprecated Remove after 2026-07-15
 */
function isLegacyFormat(parsed: unknown): boolean {
  if (typeof parsed !== 'object' || parsed === null) return true
  const obj = parsed as Record<string, unknown>
  return !('accessedAt' in obj && 'data' in obj)
}

function wrapForStorage<T>(data: T): string {
  return JSON.stringify({ accessedAt: Date.now(), data })
}

/**
 * @deprecated Legacy handling can be removed after 2026-07-15
 */
function unwrapFromStorage<T>(raw: string): StorageEntry<T> {
  const parsed = JSON.parse(raw)
  if (isLegacyFormat(parsed)) {
    return { accessedAt: 0, data: parsed as T }
  }
  return parsed as StorageEntry<T>
}

function getEvictableKeys(keyPattern: RegExp, excludeKey?: string): string[] {
  const entries: Array<{ key: string; accessedAt: number }> = []

  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i)
    if (
      !key ||
      !keyPattern.test(key) ||
      isProtectedKey(key) ||
      key === excludeKey
    )
      continue

    const raw = sessionStorage.getItem(key)
    if (!raw) continue

    try {
      const { accessedAt } = unwrapFromStorage(raw)
      entries.push({ key, accessedAt })
    } catch {
      entries.push({ key, accessedAt: 0 })
    }
  }

  return entries.sort((a, b) => a.accessedAt - b.accessedAt).map((e) => e.key)
}

function evictOldestEntries(
  keyPattern: RegExp,
  excludeKey: string,
  count: number
): number {
  const keys = getEvictableKeys(keyPattern, excludeKey)
  const toEvict = keys.slice(0, count)

  for (const key of toEvict) {
    sessionStorage.removeItem(key)
  }

  return toEvict.length
}

/**
 * Stores data in session storage with automatic eviction on quota exceeded.
 * @returns true if stored successfully, false if storage failed after retries
 */
export function setWithEviction<T>(
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
        console.error('[WorkflowStorage] Unexpected storage error')
        return false
      }

      if (attempt === MAX_EVICTION_ATTEMPTS) {
        console.warn(
          '[WorkflowStorage] Storage full after max eviction attempts'
        )
        return false
      }

      const evicted = evictOldestEntries(evictionPattern, key, attempt + 1)
      if (evicted === 0) {
        console.warn('[WorkflowStorage] No entries available for eviction')
        return false
      }
    }
  }

  return false
}

/**
 * Gets data from session storage, updating access time for eviction tracking.
 * @returns The stored data, or null if not found
 */
export function getWithAccessTracking<T>(
  key: string,
  updateAccessTime = true
): T | null {
  const raw = sessionStorage.getItem(key)
  if (!raw) return null

  try {
    const entry = unwrapFromStorage<T>(raw)

    if (updateAccessTime) {
      try {
        sessionStorage.setItem(key, wrapForStorage(entry.data))
      } catch {
        // Ignore quota errors when updating access time
      }
    }

    return entry.data
  } catch {
    console.warn('[WorkflowStorage] Failed to parse entry:', key)
    return null
  }
}

export function removeFromStorage(key: string): void {
  sessionStorage.removeItem(key)
}
