/**
 * Workflow Draft Store
 *
 * The V2 store API uses collision-free V3 per-draft keys in localStorage.
 * Handles LRU eviction and quota management.
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'

import { reportError } from '@/platform/telemetry/reportError'
import { app as comfyApp } from '@/scripts/app'

import type { DraftIndexV3 } from '../base/draftTypes'
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
import { getWorkspaceId } from '../base/storageKeys'
import {
  deleteOrphanPayloads,
  deletePayload,
  deletePayloads,
  getPayloadKeys,
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
  // In-memory cache of the index per workspace (synced with localStorage)
  // Key is workspaceId, value is the cached index
  const indexCacheByWorkspace = ref<Record<string, DraftIndexV3>>({})

  /**
   * Gets the current workspace ID fresh (not cached).
   * This ensures operations use the correct workspace after switches.
   */
  function currentWorkspaceId(): string {
    return getWorkspaceId()
  }

  /**
   * Loads the index from localStorage or creates empty.
   */
  function loadIndex(): DraftIndexV3 {
    const workspaceId = currentWorkspaceId()

    const cached = getCachedIndex(workspaceId)
    if (cached) return cached

    const stored = readIndex(workspaceId)
    if (stored) {
      // Clean up any index/payload drift
      const payloadKeys = new Set(getPayloadKeys(workspaceId))
      const cleaned = removeOrphanedEntries(stored, payloadKeys)
      indexCacheByWorkspace.value[workspaceId] = cleaned

      // Also clean up orphan payloads
      const indexKeys = new Set(cleaned.order)
      deleteOrphanPayloads(workspaceId, indexKeys)

      return cleaned
    }

    const emptyIndex = createEmptyIndex()
    indexCacheByWorkspace.value[workspaceId] = emptyIndex
    return emptyIndex
  }

  function getCachedIndex(workspaceId: string): DraftIndexV3 | null {
    return indexCacheByWorkspace.value[workspaceId]
  }

  /**
   * Persists the current index to localStorage.
   */
  function persistIndex(index: DraftIndexV3): boolean {
    const workspaceId = currentWorkspaceId()
    indexCacheByWorkspace.value[workspaceId] = index
    return writeIndex(workspaceId, index)
  }

  /**
   * Saves a draft (data + metadata).
   * Primes index cache, writes payload, then persists updated index.
   */
  function saveDraft(path: string, data: string, meta: DraftMeta): boolean {
    if (!isStorageAvailable()) return false

    const workspaceId = currentWorkspaceId()
    const draftKey = path
    const now = Date.now()

    // Prime the index cache before writing payload.
    // loadIndex() runs orphan cleanup on cache miss, which would
    // delete a payload written before the index is updated.
    const index = loadIndex()

    // Write payload before persisting the updated index
    const payloadWritten = writePayload(workspaceId, draftKey, {
      path,
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
      deletePayload(workspaceId, draftKey)
      persistIndex(index)
      return false
    }

    deletePayloads(workspaceId, evicted)
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
    const workspaceId = currentWorkspaceId()
    const draftKey = path

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
        deletePayload(workspaceId, result.removedKey)
        evictedCount++
      }

      const now = Date.now()
      if (writePayload(workspaceId, draftKey, { path, data, updatedAt: now })) {
        const { index: finalIndex } = upsertEntry(
          currentIndex,
          path,
          { ...meta, updatedAt: now },
          MAX_DRAFTS
        )
        if (!persistIndex(finalIndex)) {
          deletePayload(workspaceId, draftKey)
          persistIndex(currentIndex)
          return false
        }
        return true
      }
    }

    persistIndex(currentIndex)
    reportQuotaExhausted(
      currentIndex,
      evictedCount,
      payloadByteSize(path, data)
    )
    markStorageUnavailable()
    return false
  }

  function getIndexEntry(
    index: DraftIndexV3,
    key: string
  ): DraftIndexV3['entries'][string] | undefined {
    return index.entries[key]
  }

  /**
   * Approximates the UTF-8 byte size of the envelope `writePayload` actually
   * stores. We hard-code `updatedAt: 0` rather than the real timestamp because
   * the missing ~12 bytes are noise compared to the kilobyte-scale workflow
   * payload this telemetry exists to measure.
   */
  function payloadByteSize(path: string, data: string): number {
    return new TextEncoder().encode(
      JSON.stringify({ path, data, updatedAt: 0 })
    ).length
  }

  function stripOrderKey(index: DraftIndexV3, orphanKey: string): DraftIndexV3 {
    return {
      ...index,
      updatedAt: Date.now(),
      order: index.order.filter((key) => key !== orphanKey)
    }
  }

  function reportQuotaExhausted(
    finalIndex: DraftIndexV3,
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
    const workspaceId = currentWorkspaceId()
    const index = loadIndex()
    const { index: newIndex, removedKey } = removeEntry(index, path)

    if (removedKey) {
      deletePayload(workspaceId, removedKey)
      persistIndex(newIndex)
    }
  }

  /**
   * Moves a draft from one path to another (rename).
   */
  function moveDraft(oldPath: string, newPath: string, name: string): void {
    const workspaceId = currentWorkspaceId()
    const index = loadIndex()
    const result = moveEntry(index, oldPath, newPath, name)

    if (result) {
      const oldPayload = readPayload(workspaceId, result.oldKey)
      if (oldPayload) {
        const written = writePayload(workspaceId, result.newKey, {
          path: newPath,
          data: oldPayload.data,
          updatedAt: oldPayload.updatedAt
        })
        if (!written) return

        if (!persistIndex(result.index)) {
          deletePayload(workspaceId, result.newKey)
          return
        }
        deletePayload(workspaceId, result.oldKey)
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
    const workspaceId = currentWorkspaceId()
    const index = loadIndex()
    const entry = getEntryByPath(index, path)
    if (!entry) return null

    const draftKey = path
    const payload = readPayload(workspaceId, draftKey)
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

    const draftKey = path
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
    const workspaceId = currentWorkspaceId()
    delete indexCacheByWorkspace.value[workspaceId]
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
