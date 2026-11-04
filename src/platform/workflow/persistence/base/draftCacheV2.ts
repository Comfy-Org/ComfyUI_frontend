/**
 * V2 Draft Cache - Pure functions for draft index manipulation.
 *
 * This module provides immutable operations on the draft index structure.
 * All functions return new objects rather than mutating inputs.
 */

import type { DraftEntryMeta, DraftIndexV2 } from './draftTypes'
import { MAX_DRAFTS } from './draftTypes'
import { hashPath } from './hashUtil'

/**
 * Finds the key a path's draft is stored under, or allocates a free one.
 *
 * `hashPath` is 32-bit, so two paths can prefer the same slot; returning an
 * occupied slot would alias one path's draft onto the other's.
 *
 * @returns the existing entry's key when `path` already has a draft, otherwise
 * a key that is guaranteed absent from `index.entries`.
 */
export function resolveDraftKey(index: DraftIndexV2, path: string): string {
  const existing = Object.entries(
    index.entries as Record<string, unknown>
  ).find(
    ([, entry]) =>
      typeof entry === 'object' &&
      entry !== null &&
      'path' in entry &&
      entry.path === path
  )?.[0]
  if (existing !== undefined) return existing

  const hash = hashPath(path)
  const taken = (key: string) => Object.hasOwn(index.entries, key)
  if (!taken(hash)) return hash
  // Terminates: each iteration rules out one entry, and the index is bounded.
  let key = `${hash}:${path}`
  for (let suffix = 2; taken(key); suffix++) key = `${hash}:${path}:${suffix}`
  return key
}

/**
 * Creates an empty draft index.
 */
export function createEmptyIndex(): DraftIndexV2 {
  return {
    v: 2,
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
  index: DraftIndexV2,
  path: string,
  meta: Omit<DraftEntryMeta, 'path'>,
  limit: number = MAX_DRAFTS,
  draftKey: string = resolveDraftKey(index, path)
): { index: DraftIndexV2; evicted: string[] } {
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
      v: 2,
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
  index: DraftIndexV2,
  path: string
): { index: DraftIndexV2; removedKey: string | null } {
  const draftKey = resolveDraftKey(index, path)

  if (!(draftKey in index.entries)) {
    return { index, removedKey: null }
  }

  const entries = { ...index.entries }
  delete entries[draftKey]

  return {
    index: {
      v: 2,
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
  index: DraftIndexV2,
  oldPath: string,
  newPath: string,
  newName: string
): { index: DraftIndexV2; oldKey: string; newKey: string } | null {
  const entriesByKey: Partial<Record<string, DraftEntryMeta>> = index.entries
  const oldKey = resolveDraftKey(index, oldPath)
  const oldEntry = entriesByKey[oldKey]
  if (!oldEntry) return null

  // Allocating through `resolveDraftKey` is what keeps a rename off another
  // path's slot: the destination's preferred hash may already be held by an
  // unrelated draft, and moving onto it would alias the two.
  const newKey = resolveDraftKey(index, newPath)
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
      v: 2,
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
export function getMostRecentKey(index: DraftIndexV2): string | null {
  return index.order.length > 0 ? index.order[index.order.length - 1] : null
}

/**
 * Gets entry metadata by path.
 */
export function getEntryByPath(
  index: DraftIndexV2,
  path: string
): DraftEntryMeta | null {
  const draftKey = resolveDraftKey(index, path)
  return index.entries[draftKey] ?? null
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
  index: DraftIndexV2,
  existingPayloadKeys: Set<string>
): DraftIndexV2 {
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
    v: 2,
    updatedAt: Date.now(),
    order,
    entries
  }
}
