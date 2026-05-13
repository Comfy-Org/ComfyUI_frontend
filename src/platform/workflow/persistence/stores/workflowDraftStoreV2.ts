/**
 * V2 Workflow Draft Store
 *
 * Uses per-draft keys in localStorage instead of a single blob.
 * Handles LRU eviction and quota management.
 */

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
  touchOrder,
  upsertEntry
} from '../base/draftCacheV2'
import type { WorkflowDraftSnapshot } from '../base/draftCache'
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
import { useWorkflowDraftStore } from './workflowDraftStore'
import { app as comfyApp } from '@/scripts/app'

interface DraftMeta {
  name: string
  isTemporary: boolean
}

interface LoadPersistedWorkflowOptions {
  /**
   * Forwarded only to the legacy V1 rollback fallback for session/localStorage
   * graph loads. Remove with the V1 rollback path after 2026-07-15.
   */
  workflowName: string | null
  preferredPath?: string | null
  fallbackToLatestDraft?: boolean
}

type DraftMoveStatus = 'moved' | 'missing' | 'failed'

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
    const written = writeIndex(workspaceId, index)
    if (!written) return false

    indexCacheByWorkspace.value[workspaceId] = index
    return true
  }

  /**
   * Saves a draft to V2 and shadow-writes the legacy store for rollback.
   */
  function saveDraft(path: string, data: string, meta: DraftMeta): boolean {
    const snapshot = createDraftSnapshot(data, meta)
    const savedV2 = saveDraftV2(path, snapshot)
    if (!savedV2) return false

    saveLegacyDraft(path, snapshot)
    return true
  }

  /**
   * Removes a draft from V2 and legacy rollback storage.
   */
  function removeDraft(path: string): void {
    removeDraftV2(path)
    removeLegacyDraft(path)
  }

  /**
   * Moves a draft from one path to another in V2 and legacy rollback storage.
   */
  function moveDraft(oldPath: string, newPath: string, name: string): boolean {
    const status = moveDraftV2(oldPath, newPath, name)
    if (status === 'moved') {
      moveLegacyDraft(oldPath, newPath, name)
    }
    return status === 'moved'
  }

  /**
   * Gets draft data by path, using legacy only as a rollback fallback.
   *
   * V2 wins equal timestamps because normal shadow-writes use the same
   * timestamp in both stores.
   */
  function getDraft(path: string): WorkflowDraftSnapshot | null {
    const v2Draft = getDraftV2(path)
    const legacyDraft = getLegacyDraft(path)

    if (!v2Draft) return legacyDraft
    if (!legacyDraft) return v2Draft
    return legacyDraft.updatedAt > v2Draft.updatedAt ? legacyDraft : v2Draft
  }

  /**
   * Marks a draft as recently used without rewriting its payload.
   */
  function markDraftUsed(path: string): void {
    markDraftUsedV2(path)
    markLegacyDraftUsed(path)
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
   * Loads a draft into the graph.
   */
  async function loadDraft(path: string): Promise<boolean> {
    const draft = getDraft(path)
    if (!draft) return false

    const loaded = await tryLoadGraph(draft.data, draft.name, () => {
      removeDraft(path)
    })

    if (loaded) {
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

    // Legacy fallback is personal-only because those keys are not
    // workspace-scoped. Remove after 2026-07-15 with the V1 rollback path.
    return await loadLegacyPersistedWorkflow(options)
  }

  /**
   * Saves a draft (data + metadata) to V2.
   * Loads the index before writing payload, then persists the updated index.
   */
  function createDraftSnapshot(
    data: string,
    meta: DraftMeta
  ): WorkflowDraftSnapshot {
    return {
      data,
      updatedAt: Date.now(),
      name: meta.name,
      isTemporary: meta.isTemporary
    }
  }

  function saveDraftV2(path: string, snapshot: WorkflowDraftSnapshot): boolean {
    if (!isStorageAvailable()) return false

    const workspaceId = currentWorkspaceId()
    const draftKey = hashPath(path)

    // Prime the index cache before writing payload.
    // loadIndex() runs orphan cleanup on cache miss, which would
    // delete a payload written before the index is updated.
    const index = loadIndex()

    // Write payload before persisting the updated index
    const payloadWritten = writePayload(workspaceId, draftKey, {
      data: snapshot.data,
      updatedAt: snapshot.updatedAt
    })

    if (!payloadWritten) {
      // Quota exceeded - try eviction loop
      return handleQuotaExceeded(path, snapshot)
    }
    const { index: newIndex, evicted } = upsertEntry(
      index,
      path,
      {
        name: snapshot.name,
        isTemporary: snapshot.isTemporary,
        updatedAt: snapshot.updatedAt
      },
      MAX_DRAFTS
    )

    // Delete evicted payloads
    deletePayloads(workspaceId, evicted)

    // Persist index
    if (!persistIndex(newIndex)) {
      // Index write failed - try to recover
      deletePayload(workspaceId, draftKey)
      return false
    }

    return true
  }

  /**
   * Handles quota exceeded by evicting oldest drafts until write succeeds.
   */
  function handleQuotaExceeded(
    path: string,
    snapshot: WorkflowDraftSnapshot
  ): boolean {
    const workspaceId = currentWorkspaceId()
    const index = loadIndex()
    const draftKey = hashPath(path)

    // Try evicting oldest entries until we can write
    let currentIndex = index
    while (currentIndex.order.length > 0) {
      const oldestKey = currentIndex.order.find((key) => key !== draftKey)
      if (!oldestKey) break // Only the target draft remains

      // Evict oldest
      const oldestEntry = Object.values(currentIndex.entries).find(
        (e) => hashPath(e.path) === oldestKey
      )
      if (!oldestEntry) break

      const result = removeEntry(currentIndex, oldestEntry.path)
      currentIndex = result.index
      if (result.removedKey) {
        deletePayload(workspaceId, result.removedKey)
      }

      // Try writing again
      const success = writePayload(workspaceId, draftKey, {
        data: snapshot.data,
        updatedAt: snapshot.updatedAt
      })

      if (success) {
        // Update index with the new entry
        const { index: finalIndex } = upsertEntry(
          currentIndex,
          path,
          {
            name: snapshot.name,
            isTemporary: snapshot.isTemporary,
            updatedAt: snapshot.updatedAt
          },
          MAX_DRAFTS
        )
        if (!persistIndex(finalIndex)) {
          deletePayload(workspaceId, draftKey)
          return false
        }
        return true
      }
    }

    // All evictions failed - mark storage as unavailable
    markStorageUnavailable()
    return false
  }

  function removeDraftV2(path: string): void {
    const workspaceId = currentWorkspaceId()
    const index = loadIndex()
    const { index: newIndex, removedKey } = removeEntry(index, path)

    if (removedKey) {
      deletePayload(workspaceId, removedKey)
      persistIndex(newIndex)
    }
  }

  function moveDraftV2(
    oldPath: string,
    newPath: string,
    name: string
  ): DraftMoveStatus {
    const workspaceId = currentWorkspaceId()
    const index = loadIndex()
    const oldEntry = getEntryByPath(index, oldPath)
    if (!oldEntry) return 'missing'

    const oldKey = hashPath(oldPath)
    const newKey = hashPath(newPath)
    const newEntry = getEntryByPath(index, newPath)
    if (oldKey !== newKey && newEntry) return 'failed'

    const result = moveEntry(index, oldPath, newPath, name)
    if (!result) return 'failed'

    const oldPayload = readPayload(workspaceId, result.oldKey)
    if (!oldPayload) {
      removeDraftV2(oldPath)
      return 'failed'
    }

    const written = writePayload(workspaceId, result.newKey, {
      data: oldPayload.data,
      updatedAt: Date.now()
    })
    if (!written) return 'failed'

    if (!persistIndex(result.index)) {
      deletePayload(workspaceId, result.newKey)
      return 'failed'
    }

    if (result.oldKey !== result.newKey) {
      deletePayload(workspaceId, result.oldKey)
    }
    return 'moved'
  }

  function getDraftV2(path: string): WorkflowDraftSnapshot | null {
    const workspaceId = currentWorkspaceId()
    const index = loadIndex()
    const entry = getEntryByPath(index, path)
    if (!entry) return null

    const draftKey = hashPath(path)
    const payload = readPayload(workspaceId, draftKey)
    if (!payload) {
      // Payload missing - clean up index
      removeDraftV2(path)
      return null
    }

    return {
      data: payload.data,
      name: entry.name,
      isTemporary: entry.isTemporary,
      updatedAt: payload.updatedAt
    }
  }

  function markDraftUsedV2(path: string): void {
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

  function saveLegacyDraft(
    path: string,
    snapshot: WorkflowDraftSnapshot
  ): boolean {
    if (!canUseLegacyDraftStore()) return false

    try {
      useWorkflowDraftStore().saveDraft(path, snapshot)
      return true
    } catch {
      // Legacy writes are rollback-only.
      // Do not block V2 persistence if they fail.
      return false
    }
  }

  function getLegacyDraft(path: string): WorkflowDraftSnapshot | null {
    if (!canUseLegacyDraftStore()) return null

    try {
      return useWorkflowDraftStore().getDraft(path) ?? null
    } catch {
      // Legacy reads are rollback fallback only. Keep V2 authoritative.
      return null
    }
  }

  function removeLegacyDraft(path: string): void {
    if (!canUseLegacyDraftStore()) return

    try {
      useWorkflowDraftStore().removeDraft(path)
    } catch {
      // Legacy writes are rollback-only.
      // Do not block V2 persistence if they fail.
    }
  }

  function moveLegacyDraft(oldPath: string, newPath: string, name: string) {
    if (!canUseLegacyDraftStore()) return

    try {
      useWorkflowDraftStore().moveDraft(oldPath, newPath, name)
    } catch {
      // Legacy writes are rollback-only.
      // Do not block V2 persistence if they fail.
    }
  }

  function markLegacyDraftUsed(path: string) {
    if (!canUseLegacyDraftStore()) return

    try {
      useWorkflowDraftStore().markDraftUsed(path)
    } catch {
      // Legacy writes are rollback-only.
      // Do not block V2 persistence if they fail.
    }
  }

  function canUseLegacyDraftStore(): boolean {
    return currentWorkspaceId() === 'personal'
  }

  async function loadLegacyPersistedWorkflow(
    options: LoadPersistedWorkflowOptions
  ): Promise<boolean> {
    if (currentWorkspaceId() !== 'personal') return false

    try {
      return await useWorkflowDraftStore().loadPersistedWorkflow(options)
    } catch {
      // Legacy reads are rollback fallback only. Keep V2 authoritative.
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
    markDraftUsed,
    getMostRecentPath,
    loadPersistedWorkflow,
    reset
  }
})
