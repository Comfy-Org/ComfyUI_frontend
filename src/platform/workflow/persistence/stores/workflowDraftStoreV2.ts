/**
 * V2 Workflow Draft Store
 *
 * Uses per-draft keys in localStorage instead of a single blob.
 * Handles LRU eviction and quota management.
 */

import { captureMessage } from '@sentry/vue'
import { defineStore } from 'pinia'
import { ref } from 'vue'

import type { DraftIndexV2 } from '../base/draftTypes'
import { MAX_DRAFTS } from '../base/draftTypes'
import {
  createEmptyIndex,
  getEntryByPath,
  getMostRecentKey,
  moveEntry,
  removeEntry,
  removeOrphanedEntries,
  upsertEntry
} from '../base/draftCacheV2'
import { hashPath } from '../base/hashUtil'
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
import { api } from '@/scripts/api'
import { app as comfyApp } from '@/scripts/app'

interface DraftMeta {
  name: string
  isTemporary: boolean
}

interface LoadPersistedWorkflowOptions {
  workflowName: string | null
  preferredPath?: string | null
  fallbackToLatestDraft?: boolean
}

export const useWorkflowDraftStoreV2 = defineStore('workflowDraftV2', () => {
  // In-memory cache of the index per workspace (synced with localStorage)
  // Key is workspaceId, value is the cached index
  const indexCacheByWorkspace = ref<Record<string, DraftIndexV2>>({})

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
  function loadIndex(): DraftIndexV2 {
    const workspaceId = currentWorkspaceId()

    if (indexCacheByWorkspace.value[workspaceId]) {
      return indexCacheByWorkspace.value[workspaceId]
    }

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

  /**
   * Persists the current index to localStorage.
   */
  function persistIndex(index: DraftIndexV2): boolean {
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
    const draftKey = hashPath(path)
    const now = Date.now()

    // Prime the index cache before writing payload.
    // loadIndex() runs orphan cleanup on cache miss, which would
    // delete a payload written before the index is updated.
    const index = loadIndex()

    // Write payload before persisting the updated index
    const payloadWritten = writePayload(workspaceId, draftKey, {
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
   */
  function handleQuotaExceeded(
    path: string,
    data: string,
    meta: DraftMeta
  ): boolean {
    const workspaceId = currentWorkspaceId()
    const draftKey = hashPath(path)

    let currentIndex = loadIndex()
    let evictedCount = 0

    while (currentIndex.order.length > 0) {
      const oldestKey = currentIndex.order.find((key) => key !== draftKey)
      if (!oldestKey) break

      const oldestEntry = currentIndex.entries[oldestKey]
      if (!oldestEntry) {
        currentIndex = stripOrderKey(currentIndex, oldestKey)
        continue
      }

      const result = removeEntry(currentIndex, oldestEntry.path)
      currentIndex = result.index
      if (result.removedKey) {
        deletePayload(workspaceId, result.removedKey)
        evictedCount++
      }

      if (
        writePayload(workspaceId, draftKey, { data, updatedAt: Date.now() })
      ) {
        const { index: finalIndex } = upsertEntry(
          currentIndex,
          path,
          { ...meta, updatedAt: Date.now() },
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
    reportQuotaExhausted(currentIndex, evictedCount, payloadByteSize(data))
    markStorageUnavailable()
    return false
  }

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
    captureMessage('localStorage quota exhausted after full draft eviction', {
      level: 'warning',
      tags: {
        error_type: 'storage_quota_exhausted',
        store: 'workflowDraftStoreV2'
      },
      extra: {
        evictedDrafts: evicted,
        remainingDrafts: finalIndex.order.length,
        incomingPayloadBytes: payloadBytes
      }
    })
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
          data: oldPayload.data,
          updatedAt: Date.now()
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
  function getDraft(
    path: string
  ): { data: string; name: string; isTemporary: boolean } | null {
    const workspaceId = currentWorkspaceId()
    const index = loadIndex()
    const entry = getEntryByPath(index, path)
    if (!entry) return null

    const draftKey = hashPath(path)
    const payload = readPayload(workspaceId, draftKey)
    if (!payload) {
      // Payload missing - clean up index
      removeDraft(path)
      return null
    }

    return {
      data: payload.data,
      name: entry.name,
      isTemporary: entry.isTemporary
    }
  }

  /**
   * Gets the most recent draft path.
   */
  function getMostRecentPath(): string | null {
    const index = loadIndex()
    const key = getMostRecentKey(index)
    if (!key) return null

    const entry = index.entries[key]
    return entry?.path ?? null
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

    return loaded
  }

  /**
   * Loads a persisted workflow with fallback chain.
   */
  async function loadPersistedWorkflow(
    options: LoadPersistedWorkflowOptions
  ): Promise<boolean> {
    const {
      workflowName,
      preferredPath,
      fallbackToLatestDraft = false
    } = options

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

    // Legacy fallbacks are NOT workspace-scoped and must only be used for
    // personal workspace to prevent cross-workspace data leakage.
    // These exist only for migration from V1 and should be removed after 2026-07-15.
    if (currentWorkspaceId() !== 'personal') {
      return false
    }

    // 3. Legacy fallback: sessionStorage payload (remove after 2026-07-15)
    const clientId = api.initialClientId ?? api.clientId
    if (clientId) {
      try {
        const sessionPayload = sessionStorage.getItem(`workflow:${clientId}`)
        if (await tryLoadGraph(sessionPayload, workflowName)) {
          return true
        }
      } catch {
        // Ignore storage access errors and continue fallback chain
      }
    }

    // 4. Legacy fallback: localStorage payload (remove after 2026-07-15)
    try {
      const localPayload = localStorage.getItem('workflow')
      return await tryLoadGraph(localPayload, workflowName)
    } catch {
      return false
    }
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
    getDraft,
    getMostRecentPath,
    loadPersistedWorkflow,
    reset
  }
})
