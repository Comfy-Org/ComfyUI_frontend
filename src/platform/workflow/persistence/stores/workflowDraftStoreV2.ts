/**
 * V2 Workflow Draft Store
 *
 * Uses per-draft keys in localStorage instead of a single blob.
 * Handles LRU eviction and quota management.
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'

import { reportError } from '@/platform/telemetry/reportError'
import { api } from '@/scripts/api'
import { app as comfyApp } from '@/scripts/app'

import type { DraftIndexV2, DraftPayloadV2 } from '../base/draftTypes'
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
import { getWorkspaceId } from '../base/storageKeys'
import {
  deleteOrphanPayloads,
  deletePayload,
  deletePayloads,
  getPayloadKeys,
  isStorageAvailable,
  readIndex,
  readPayload,
  readPayloadRaw,
  writeIndex,
  writePayload,
  writePayloadRaw
} from '../base/storageIO'

interface DraftMeta {
  name: string
  isTemporary: boolean
  isModified?: boolean
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
  let saveFailureNotified = false
  let persistencePauseDepth = 0

  /**
   * Gets the current workspace ID fresh (not cached).
   * This ensures operations use the correct workspace after switches.
   */
  function currentWorkspaceId(): string {
    return getWorkspaceId()
  }

  /**
   * Returns true only for the first failure in a continuous persistence-failure
   * episode. localStorage quota/availability is shared by all workflow paths,
   * and a single graph load can invoke both draft-save callers.
   */
  function shouldNotifySaveFailure(): boolean {
    if (saveFailureNotified) return false
    saveFailureNotified = true
    return true
  }

  /** Any successful draft save proves persistence recovered and resets the episode. */
  function markSaveSucceeded(): void {
    saveFailureNotified = false
  }

  /**
   * Temporarily suppresses draft writes initiated by graph-load lifecycle hooks.
   * This is caller-coordination state rather than a storage mutex: lifecycle
   * callers check isPersistencePaused() before invoking the low-level saveDraft
   * primitive. The returned resume function is idempotent and supports nesting.
   */
  function pausePersistence(): () => void {
    persistencePauseDepth++
    let resumed = false
    return () => {
      if (resumed) return
      resumed = true
      persistencePauseDepth = Math.max(0, persistencePauseDepth - 1)
    }
  }

  function isPersistencePaused(): boolean {
    return persistencePauseDepth > 0
  }

  /**
   * Loads the index from localStorage or creates empty.
   */
  function loadIndex(): DraftIndexV2 {
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

  function getCachedIndex(workspaceId: string): DraftIndexV2 | null {
    return indexCacheByWorkspace.value[workspaceId]
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
   * Existing overwrites commit small metadata before atomically replacing the
   * payload; exceptional failure paths retain exact rollback semantics.
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
    const existingEntry = getIndexEntry(index, draftKey)
    const { index: newIndex, evicted } = upsertEntry(
      index,
      path,
      { ...meta, updatedAt: now },
      MAX_DRAFTS
    )

    // Overwriting an indexed draft is the normal autosave/tab-switch path.
    // Commit its small metadata update first so we do not synchronously read
    // and copy the entire previous workflow payload solely for a rollback that
    // is only needed if a later index write fails. localStorage.setItem() is
    // atomic: if the payload write fails, the previous payload is unchanged.
    if (existingEntry && evicted.length === 0) {
      if (!persistIndex(newIndex)) {
        indexCacheByWorkspace.value[workspaceId] = index
        const previousPayload = readPayloadRaw(workspaceId, draftKey)
        return handleQuotaExceeded(path, data, meta, previousPayload)
      }

      let payloadWritten: boolean
      try {
        payloadWritten = writePayload(workspaceId, draftKey, {
          data,
          updatedAt: now
        })
      } catch (error) {
        if (!persistIndex(index)) {
          delete indexCacheByWorkspace.value[workspaceId]
        }
        throw error
      }

      if (payloadWritten) return true

      // A failed setItem leaves the old payload intact. Restore the old index
      // before entering quota recovery, then take the expensive raw snapshot
      // only on this exceptional path where rollback may actually need it.
      if (!persistIndex(index)) {
        delete indexCacheByWorkspace.value[workspaceId]
        return false
      }
      const previousPayload = readPayloadRaw(workspaceId, draftKey)
      return handleQuotaExceeded(path, data, meta, previousPayload)
    }

    // New/unindexed targets can be rolled back by deletion, so there is no
    // committed payload to snapshot on the successful path. Keep the raw read
    // for the unusual indexed+eviction case only.
    const previousPayload = existingEntry
      ? readPayloadRaw(workspaceId, draftKey)
      : null

    // Write payload before persisting the updated index.
    const payloadWritten = writePayload(workspaceId, draftKey, {
      data,
      updatedAt: now
    })

    if (!payloadWritten) {
      return handleQuotaExceeded(path, data, meta, previousPayload)
    }

    // Commit index ownership before deleting LRU payloads. If the index write
    // fails, the previous payload/index pair remains recoverable.
    if (!persistIndex(newIndex)) {
      if (restoreTargetPayload(workspaceId, draftKey, previousPayload)) {
        indexCacheByWorkspace.value[workspaceId] = index
      } else {
        delete indexCacheByWorkspace.value[workspaceId]
        console.error(
          '[Workflow Drafts] Failed to restore target payload after index write failure'
        )
      }
      return false
    }

    deletePayloads(workspaceId, evicted)
    return true
  }

  function restoreTargetPayload(
    workspaceId: string,
    draftKey: string,
    previousPayload: string | null
  ): boolean {
    if (previousPayload === null) {
      return deletePayload(workspaceId, draftKey)
    }

    try {
      if (writePayloadRaw(workspaceId, draftKey, previousPayload)) return true
    } catch (error) {
      console.error(
        '[Workflow Drafts] Failed to restore target payload directly',
        error
      )
    }

    // Replacing a larger failed payload can itself hit quota. Removing the
    // uncommitted replacement first frees its bytes before retrying the exact
    // previous payload.
    if (!deletePayload(workspaceId, draftKey)) return false

    try {
      return writePayloadRaw(workspaceId, draftKey, previousPayload)
    } catch (error) {
      console.error(
        '[Workflow Drafts] Failed to restore target payload after cleanup',
        error
      )
      return false
    }
  }

  function stripOrderKey(index: DraftIndexV2, draftKey: string): DraftIndexV2 {
    const entries = { ...index.entries }
    delete entries[draftKey]
    return {
      ...index,
      updatedAt: Date.now(),
      order: index.order.filter((key) => key !== draftKey),
      entries
    }
  }

  function discardDriftedKey(
    workspaceId: string,
    index: DraftIndexV2,
    draftKey: string,
    evictedPayloads: Map<string, DraftPayloadV2>
  ): DraftIndexV2 | null {
    const driftedPayload = readPayload(workspaceId, draftKey)
    const cleanedIndex = stripOrderKey(index, draftKey)
    if (!persistIndex(cleanedIndex)) return null

    // The index no longer owns this corrupt key. Remove its payload as part of
    // the same quota-recovery transaction so stale storage actually frees
    // space; rollbackQuotaEvictions restores it if the incoming save fails.
    if (driftedPayload) evictedPayloads.set(draftKey, driftedPayload)
    if (!deletePayload(workspaceId, draftKey)) return null
    return cleanedIndex
  }

  function rollbackQuotaEvictions(
    workspaceId: string,
    originalIndex: DraftIndexV2,
    evictedPayloads: Map<string, DraftPayloadV2>,
    unrestoredTargetKey?: string
  ): boolean {
    let payloadRestoreFailed = false
    for (const [draftKey, payload] of evictedPayloads) {
      try {
        if (
          !readPayload(workspaceId, draftKey) &&
          !writePayload(workspaceId, draftKey, payload)
        ) {
          payloadRestoreFailed = true
        }
      } catch (error) {
        payloadRestoreFailed = true
        console.error(
          '[Workflow Drafts] Failed to restore an evicted draft payload',
          error
        )
      }
    }

    // If target rollback failed, do not let stale uncommitted target bytes make
    // the recovered index appear complete. Any surviving bytes remain orphaned
    // and are removed by normal cold-load cleanup.
    const payloadKeys = new Set(getPayloadKeys(workspaceId))
    if (unrestoredTargetKey) payloadKeys.delete(unrestoredTargetKey)
    const recoveredIndex = removeOrphanedEntries(originalIndex, payloadKeys)

    try {
      if (!writeIndex(workspaceId, recoveredIndex)) {
        delete indexCacheByWorkspace.value[workspaceId]
        console.error(
          '[Workflow Drafts] Failed to restore draft index after quota rollback'
        )
        return false
      }
    } catch (error) {
      delete indexCacheByWorkspace.value[workspaceId]
      console.error(
        '[Workflow Drafts] Failed to restore draft index after quota rollback',
        error
      )
      return false
    }

    if (payloadRestoreFailed) {
      delete indexCacheByWorkspace.value[workspaceId]
      console.error(
        '[Workflow Drafts] Quota rollback could not restore every evicted payload'
      )
      return false
    }

    indexCacheByWorkspace.value[workspaceId] = recoveredIndex
    return true
  }

  /**
   * Handles quota exceeded by evicting oldest drafts until write succeeds.
   * Evictions are rolled back if the incoming draft cannot be committed.
   */
  function handleQuotaExceeded(
    path: string,
    data: string,
    meta: DraftMeta,
    previousPayload: string | null
  ): boolean {
    const workspaceId = currentWorkspaceId()
    const originalIndex = loadIndex()
    const draftKey = hashPath(path)
    const evictedPayloads = new Map<string, DraftPayloadV2>()
    let targetWritten = false

    try {
      let currentIndex = originalIndex
      let evictedCount = 0
      while (currentIndex.order.length > 0) {
        const oldestKey = currentIndex.order.find((key) => key !== draftKey)
        if (!oldestKey) break

        const oldestEntry = getIndexEntry(currentIndex, oldestKey)
        const result = oldestEntry
          ? removeEntry(currentIndex, oldestEntry.path)
          : null
        if (!result?.removedKey) {
          const cleanedIndex = discardDriftedKey(
            workspaceId,
            currentIndex,
            oldestKey,
            evictedPayloads
          )
          if (!cleanedIndex) {
            rollbackQuotaEvictions(workspaceId, originalIndex, evictedPayloads)
            return false
          }
          currentIndex = cleanedIndex
          continue
        }

        const evictedPayload = readPayload(workspaceId, result.removedKey)

        // Make the index stop owning this payload before deleting it. This keeps
        // index/payload invariants recoverable even if the page dies mid-retry.
        if (!persistIndex(result.index)) {
          rollbackQuotaEvictions(workspaceId, originalIndex, evictedPayloads)
          return false
        }
        currentIndex = result.index

        if (evictedPayload) {
          evictedPayloads.set(result.removedKey, evictedPayload)
        }
        if (!deletePayload(workspaceId, result.removedKey)) {
          rollbackQuotaEvictions(workspaceId, originalIndex, evictedPayloads)
          return false
        }
        evictedCount++

        const now = Date.now()
        if (writePayload(workspaceId, draftKey, { data, updatedAt: now })) {
          targetWritten = true
          const { index: finalIndex, evicted } = upsertEntry(
            currentIndex,
            path,
            { ...meta, updatedAt: now },
            MAX_DRAFTS
          )
          if (persistIndex(finalIndex)) {
            deletePayloads(workspaceId, evicted)
            return true
          }

          const targetRestored = restoreTargetPayload(
            workspaceId,
            draftKey,
            previousPayload
          )
          const evictionsRestored = rollbackQuotaEvictions(
            workspaceId,
            originalIndex,
            evictedPayloads,
            targetRestored ? undefined : draftKey
          )
          if (!targetRestored || !evictionsRestored) {
            delete indexCacheByWorkspace.value[workspaceId]
          }
          return false
        }
      }

      reportQuotaExhausted(currentIndex, evictedCount, payloadByteSize(data))
      rollbackQuotaEvictions(workspaceId, originalIndex, evictedPayloads)
      return false
    } catch (error) {
      const targetRestored =
        !targetWritten ||
        restoreTargetPayload(workspaceId, draftKey, previousPayload)
      const evictionsRestored = rollbackQuotaEvictions(
        workspaceId,
        originalIndex,
        evictedPayloads,
        targetRestored ? undefined : draftKey
      )
      if (!targetRestored || !evictionsRestored) {
        delete indexCacheByWorkspace.value[workspaceId]
      }
      throw error
    }
  }

  function getIndexEntry(
    index: DraftIndexV2,
    key: string
  ): DraftIndexV2['entries'][string] | undefined {
    return index.entries[key]
  }

  /**
   * Measures the UTF-8 byte size of the serialized payload envelope.
   */
  function payloadByteSize(data: string): number {
    return new TextEncoder().encode(JSON.stringify({ data, updatedAt: 0 }))
      .length
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
    isModified?: boolean
    updatedAt: number
  } | null {
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
      isTemporary: entry.isTemporary,
      isModified: entry.isModified,
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
    saveFailureNotified = false
  }

  return {
    saveDraft,
    removeDraft,
    moveDraft,
    markDraftUsed,
    getDraft,
    getMostRecentPath,
    loadPersistedWorkflow,
    reset,
    shouldNotifySaveFailure,
    markSaveSucceeded,
    pausePersistence,
    isPersistencePaused
  }
})
