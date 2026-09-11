/**
 * V2 Workflow Draft Store
 *
 * Uses per-draft keys in localStorage instead of a single blob.
 * Handles LRU eviction and quota management.
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'

import { reportError } from '@/platform/telemetry/reportError'
import { app as comfyApp } from '@/scripts/app'

import type { DraftIndexV2 } from '../base/draftTypes'
import { MAX_DRAFTS } from '../base/draftTypes'
import {
  createEmptyIndex,
  getEntryByPath,
  getMostRecentKey,
  moveEntry,
  removeEntry,
  removeOrphanedEntries,
  touchOrder,
  upsertEntry
} from '../base/draftCacheV2'
import { hashPath } from '../base/hashUtil'
import {
  deleteOrphanPayloads,
  deletePayload,
  deletePayloads,
  getPayloadKeys,
  getStorageScope,
  isStorageAvailable,
  markStorageUnavailable,
  readIndex,
  readPayload,
  writeIndex,
  writePayload
} from '../base/storageIO'

interface DraftMeta {
  name: string
  isTemporary: boolean
}

interface LoadPersistedWorkflowOptions {
  preferredPath?: string | null
  fallbackToLatestDraft?: boolean
}

export const useWorkflowDraftStoreV2 = defineStore('workflowDraftV2', () => {
  // In-memory cache of the index per scope (synced with localStorage)
  const indexCacheByScope = ref<Record<string, DraftIndexV2>>({})

  /**
   * Loads the index from localStorage or creates empty.
   */
  function loadIndex(): DraftIndexV2 {
    const scope = getStorageScope()
    if (!scope) return createEmptyIndex()

    const cached = getCachedIndex(scope)
    if (cached) return cached

    const stored = readIndex(scope)
    if (stored) {
      // Clean up any index/payload drift
      const payloadKeys = new Set(getPayloadKeys(scope))
      const cleaned = removeOrphanedEntries(stored, payloadKeys)
      indexCacheByScope.value[scope] = cleaned

      // Also clean up orphan payloads
      const indexKeys = new Set(cleaned.order)
      deleteOrphanPayloads(scope, indexKeys)

      return cleaned
    }

    const emptyIndex = createEmptyIndex()
    indexCacheByScope.value[scope] = emptyIndex
    return emptyIndex
  }

  function getCachedIndex(scope: string): DraftIndexV2 | null {
    return indexCacheByScope.value[scope]
  }

  /**
   * Persists the current index to localStorage.
   */
  function persistIndex(index: DraftIndexV2): boolean {
    const scope = getStorageScope()
    if (!scope) return false
    indexCacheByScope.value[scope] = index
    return writeIndex(scope, index)
  }

  /**
   * Saves a draft (data + metadata).
   * Primes index cache, writes payload, then persists updated index.
   */
  function saveDraft(path: string, data: string, meta: DraftMeta): boolean {
    const scope = getStorageScope()
    if (!scope || !isStorageAvailable()) return false

    const draftKey = hashPath(path)
    const now = Date.now()

    // Prime the index cache before writing payload.
    // loadIndex() runs orphan cleanup on cache miss, which would
    // delete a payload written before the index is updated.
    const index = loadIndex()

    // Write payload before persisting the updated index
    const payloadWritten = writePayload(scope, draftKey, {
      data,
      updatedAt: now
    })

    if (!payloadWritten) {
      // Quota exceeded - try eviction loop
      return handleQuotaExceeded(path, data, meta)
    }
    const { index: newIndex, evicted } = upsertEntry(
      index,
      path,
      { ...meta, updatedAt: now },
      MAX_DRAFTS
    )

    if (!persistIndex(newIndex)) {
      deletePayload(scope, draftKey)
      persistIndex(index)
      return false
    }

    deletePayloads(scope, evicted)
    return true
  }

  /**
   * Handles quota exceeded by evicting oldest drafts until write succeeds.
   *
   * Tolerates index/payload desync: orphaned `order` keys with no matching
   * entry in `entries` are stripped in-place and the loop continues, rather
   * than bailing out and leaving evictable drafts behind.
   *
   * Recovery writes (`persistIndex(currentIndex)` after a failed write) are
   * best-effort; their return value is intentionally ignored because there
   * is no useful action to take when the recovery itself also fails — the
   * caller will already see `false` and surface the toast. A subsequent
   * `saveDraft` will re-converge the index via `removeOrphanedEntries`.
   */
  function handleQuotaExceeded(
    path: string,
    data: string,
    meta: DraftMeta
  ): boolean {
    const scope = getStorageScope()
    if (!scope) return false
    const draftKey = hashPath(path)

    let currentIndex = loadIndex()
    let evictedCount = 0

    while (currentIndex.order.length > 0) {
      const oldestKey = currentIndex.order.find((key) => key !== draftKey)
      if (!oldestKey) break

      const oldestEntry = currentIndex.entries[oldestKey]
      if (!getIndexEntry(currentIndex, oldestKey)) {
        currentIndex = stripOrderKey(currentIndex, oldestKey)
        continue
      }

      const result = removeEntry(currentIndex, oldestEntry.path)
      currentIndex = result.index
      if (result.removedKey) {
        deletePayload(scope, result.removedKey)
        evictedCount++
      }

      const now = Date.now()
      if (writePayload(scope, draftKey, { data, updatedAt: now })) {
        const { index: finalIndex } = upsertEntry(
          currentIndex,
          path,
          { ...meta, updatedAt: now },
          MAX_DRAFTS
        )
        if (!persistIndex(finalIndex)) {
          deletePayload(scope, draftKey)
          persistIndex(currentIndex)
          return false
        }
        return true
      }
    }

    persistIndex(currentIndex)
    reportQuotaExhausted(currentIndex, evictedCount, payloadByteSize(data))
    markStorageUnavailable()
    return false
  }

  function getIndexEntry(
    index: DraftIndexV2,
    key: string
  ): DraftIndexV2['entries'][string] | undefined {
    return index.entries[key]
  }

  /**
   * Approximates the UTF-8 byte size of the envelope `writePayload` actually
   * stores. We hard-code `updatedAt: 0` rather than the real timestamp because
   * the missing ~12 bytes are noise compared to the kilobyte-scale workflow
   * payload this telemetry exists to measure.
   */
  function payloadByteSize(data: string): number {
    return new TextEncoder().encode(JSON.stringify({ data, updatedAt: 0 }))
      .length
  }

  function stripOrderKey(index: DraftIndexV2, orphanKey: string): DraftIndexV2 {
    return {
      ...index,
      updatedAt: Date.now(),
      order: index.order.filter((key) => key !== orphanKey)
    }
  }

  function reportQuotaExhausted(
    finalIndex: DraftIndexV2,
    evicted: number,
    payloadBytes: number
  ): void {
    reportError(
      new Error('localStorage quota exhausted after full draft eviction'),
      {
        errorType: 'storage_quota_exhausted',
        level: 'warning',
        tags: { store: 'workflowDraftStoreV2' },
        context: {
          evictedDrafts: evicted,
          remainingDrafts: finalIndex.order.length,
          incomingPayloadBytes: payloadBytes
        }
      }
    )
  }

  /**
   * Removes a draft.
   */
  function removeDraft(path: string): void {
    const scope = getStorageScope()
    if (!scope) return
    const index = loadIndex()
    const { index: newIndex, removedKey } = removeEntry(index, path)

    if (removedKey) {
      deletePayload(scope, removedKey)
      persistIndex(newIndex)
    }
  }

  /**
   * Moves a draft from one path to another (rename).
   */
  function moveDraft(oldPath: string, newPath: string, name: string): void {
    const scope = getStorageScope()
    if (!scope) return
    const index = loadIndex()
    const result = moveEntry(index, oldPath, newPath, name)

    if (result) {
      const oldPayload = readPayload(scope, result.oldKey)
      if (oldPayload) {
        const written = writePayload(scope, result.newKey, {
          data: oldPayload.data,
          updatedAt: oldPayload.updatedAt
        })
        if (!written) return

        if (!persistIndex(result.index)) {
          deletePayload(scope, result.newKey)
          return
        }
        deletePayload(scope, result.oldKey)
      }
    }
  }

  /**
   * Gets draft data by path.
   */
  function getDraft(path: string): {
    data: string
    name: string
    isTemporary: boolean
    updatedAt: number
  } | null {
    const scope = getStorageScope()
    if (!scope) return null
    const index = loadIndex()
    const entry = getEntryByPath(index, path)
    if (!entry) return null

    const draftKey = hashPath(path)
    const payload = readPayload(scope, draftKey)
    if (!payload) {
      // Payload missing - clean up index
      removeDraft(path)
      return null
    }

    return {
      data: payload.data,
      name: entry.name,
      isTemporary: entry.isTemporary,
      updatedAt: payload.updatedAt
    }
  }

  /**
   * Marks a draft as recently used without rewriting its payload.
   */
  function markDraftUsed(path: string): void {
    const index = loadIndex()
    const entry = getEntryByPath(index, path)
    if (!entry) return

    const draftKey = hashPath(path)
    persistIndex({
      ...index,
      updatedAt: Date.now(),
      order: touchOrder(index.order, draftKey)
    })
  }

  /**
   * Gets the most recent draft path.
   */
  function getMostRecentPath(): string | null {
    const index = loadIndex()
    const key = getMostRecentKey(index)
    if (!key) return null

    return getIndexEntry(index, key)?.path ?? null
  }

  /**
   * Tries to load workflow data into the graph.
   */
  async function tryLoadGraph(
    payload: string | null,
    workflowName: string | null,
    onFailure?: () => void
  ): Promise<boolean> {
    if (!payload) return false
    try {
      const workflow = JSON.parse(payload)
      await comfyApp.loadGraphData(workflow, true, true, workflowName)
      return true
    } catch (err) {
      console.error('Failed to load persisted workflow', err)
      onFailure?.()
      return false
    }
  }

  /**
   * Loads a draft into the graph.
   */
  async function loadDraft(path: string): Promise<boolean> {
    const draft = getDraft(path)
    if (!draft) return false

    const loaded = await tryLoadGraph(draft.data, draft.name, () => {
      removeDraft(path)
    })
    if (loaded) {
      // Direct persisted-draft restores do not go through ComfyWorkflow.load().
      markDraftUsed(path)
    }

    return loaded
  }

  /**
   * Loads a persisted workflow with fallback chain.
   */
  async function loadPersistedWorkflow(
    options: LoadPersistedWorkflowOptions
  ): Promise<boolean> {
    const { preferredPath, fallbackToLatestDraft = false } = options

    // 1. Try preferred path
    if (preferredPath && (await loadDraft(preferredPath))) {
      return true
    }

    // 2. Fall back to most recent draft
    if (fallbackToLatestDraft) {
      const mostRecent = getMostRecentPath()
      if (mostRecent && (await loadDraft(mostRecent))) {
        return true
      }
    }

    return false
  }

  /**
   * Resets the store (clears in-memory cache for current workspace).
   */
  function reset(): void {
    const scope = getStorageScope()
    if (!scope) return
    delete indexCacheByScope.value[scope]
  }

  return {
    saveDraft,
    removeDraft,
    moveDraft,
    markDraftUsed,
    getDraft,
    getMostRecentPath,
    loadPersistedWorkflow,
    reset
  }
})
