/**
 * Draft Cache - Pure functions for V3 draft index manipulation.
 *
 * This module provides immutable operations on the draft index structure.
 * All functions return new objects rather than mutating inputs.
 */

import type { DraftEntryMeta, DraftIndexV3 } from './draftTypes'
import { MAX_DRAFTS } from './draftTypes'

/**
 * Creates an empty draft index.
 */
export function createEmptyIndex(): DraftIndexV3 {
  return {
    v: 3,
    updatedAt: Date.now(),
    order: [],
    entries: {}
  }
}

/**
 * Moves a draft key to the end of the LRU order (most recently used).
 */
export function touchOrder(order: string[], draftKey: string): string[] {
  const filtered = order.filter((key) => key !== draftKey)
  return [...filtered, draftKey]
}

/**
 * Adds or updates a draft entry in the index.
 * Handles LRU eviction if over the limit.
 *
 * @returns Object with updated index and list of evicted draft keys
 */
export function upsertEntry(
  index: DraftIndexV3,
  path: string,
  meta: Omit<DraftEntryMeta, 'path'>,
  limit: number = MAX_DRAFTS
): { index: DraftIndexV3; evicted: string[] } {
  const draftKey = path
  const effectiveLimit = Math.max(1, limit)

  const entries = {
    ...index.entries,
    [draftKey]: { ...meta, path }
  }

  const touchedOrder = touchOrder(index.order, draftKey)
  const evicted: string[] = []

  let evictCount = 0
  while (touchedOrder.length - evictCount > effectiveLimit) {
    const oldest = touchedOrder[evictCount]
    if (oldest && oldest !== draftKey) {
      delete entries[oldest]
      evicted.push(oldest)
    }
    evictCount++
  }

  const finalOrder = touchedOrder.slice(evictCount)

  return {
    index: {
      v: 3,
      updatedAt: Date.now(),
      order: finalOrder,
      entries
    },
    evicted
  }
}

/**
 * Removes a draft entry from the index.
 *
 * @returns Object with updated index and the removed draft key (if any)
 */
export function removeEntry(
  index: DraftIndexV3,
  path: string
): { index: DraftIndexV3; removedKey: string | null } {
  const draftKey = path

  if (!(draftKey in index.entries)) {
    return { index, removedKey: null }
  }

  const entries = { ...index.entries }
  delete entries[draftKey]

  return {
    index: {
      v: 3,
      updatedAt: Date.now(),
      order: index.order.filter((key) => key !== draftKey),
      entries
    },
    removedKey: draftKey
  }
}

/**
 * Moves a draft from one path to another (rename operation).
 * Updates index recency only; callers keep the payload timestamp unchanged.
 *
 * @returns Object with updated index and keys involved
 */
export function moveEntry(
  index: DraftIndexV3,
  oldPath: string,
  newPath: string,
  newName: string
): { index: DraftIndexV3; oldKey: string; newKey: string } | null {
  const oldKey = oldPath
  const newKey = newPath

  const entriesByKey: Partial<Record<string, DraftEntryMeta>> = index.entries
  const oldEntry = entriesByKey[oldKey]
  if (!oldEntry) return null
  if (oldKey !== newKey && entriesByKey[newKey]) return null

  const entries = { ...index.entries }
  delete entries[oldKey]

  entries[newKey] = {
    ...oldEntry,
    path: newPath,
    name: newName,
    updatedAt: Date.now()
  }

  const order = index.order
    .filter((key) => key !== oldKey && key !== newKey)
    .concat(newKey)

  return {
    index: {
      v: 3,
      updatedAt: Date.now(),
      order,
      entries
    },
    oldKey,
    newKey
  }
}

/**
 * Gets the most recently used draft key.
 */
export function getMostRecentKey(index: DraftIndexV3): string | null {
  return index.order.length > 0 ? index.order[index.order.length - 1] : null
}

/**
 * Gets entry metadata by path.
 */
export function getEntryByPath(
  index: DraftIndexV3,
  path: string
): DraftEntryMeta | null {
  const entriesByKey: Partial<Record<string, DraftEntryMeta>> = index.entries
  const entry = entriesByKey[path]
  return entry?.path === path ? entry : null
}

/**
 * Removes entries from index that don't have corresponding payloads.
 * Used for index/payload drift recovery.
 *
 * @param index - The draft index
 * @param existingPayloadKeys - Set of draft keys that have payloads in storage
 * @returns Updated index with orphaned entries removed
 */
export function removeOrphanedEntries(
  index: DraftIndexV3,
  existingPayloadKeys: Set<string>
): DraftIndexV3 {
  const entries: Record<string, DraftEntryMeta> = {}
  const order: string[] = []
  const entriesByKey: Partial<Record<string, DraftEntryMeta>> = index.entries

  for (const key of index.order) {
    const entry = entriesByKey[key]
    if (existingPayloadKeys.has(key) && entry) {
      entries[key] = entry
      order.push(key)
    }
  }

  return {
    v: 3,
    updatedAt: Date.now(),
    order,
    entries
  }
}
