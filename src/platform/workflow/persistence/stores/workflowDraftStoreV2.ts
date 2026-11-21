import { defineStore } from 'pinia'
import { ref } from 'vue'

import { reportError } from '@comfyorg/telemetry/reportError'
import { useApp } from '@/scripts/appInstance'

import type {
  DraftIndexV2,
  DraftLineage,
  DraftPayloadV2
} from '@/platform/workflow/persistence/base/draftTypes'
import {
  createEmptyIndex,
  getEntryByPath,
  getMostRecentKey,
  moveEntry,
  removeEntry,
  removeOrphanedEntries,
  touchOrder,
  upsertEntry
} from '@/platform/workflow/persistence/base/draftCacheV2'
import { hashPath } from '@/platform/workflow/persistence/base/hashUtil'
import { getWorkspaceId } from '@/platform/workflow/persistence/base/storageKeys'
import {
  deleteOrphanPayloads,
  deletePayload,
  getPayloadKeys,
  isStorageAvailable,
  readIndex,
  readPayload,
  writeIndex,
  writePayload
} from '@/platform/workflow/persistence/base/storageIO'

interface DraftMeta {
  name: string
  isTemporary: boolean
}

interface LoadPersistedWorkflowOptions {
  preferredPath?: string | null
  fallbackToLatestDraft?: boolean
  isCurrent?: () => boolean
}

export const useWorkflowDraftStoreV2 = defineStore('workflowDraftV2', () => {
  // In-memory cache of the index per workspace (synced with localStorage)
  // Key is workspaceId, value is the cached index
  const indexCacheByWorkspace = ref<Record<string, DraftIndexV2>>({})
  const lineageByDraft = new Map<string, DraftLineage>()
  const reportedQuotaByDraft = new Set<string>()
  const authSubject = ref<string | null | undefined>(undefined)

  /**
   * Gets the current workspace ID fresh (not cached).
   * This ensures operations use the correct workspace after switches.
   */
  function currentWorkspaceId(): string {
    const workspaceId = getWorkspaceId()
    const subject = authSubject.value
    if (subject === undefined) return workspaceId
    return `${encodeURIComponent(subject ?? 'unauthenticated')}:${workspaceId}`
  }

  function setAuthSubject(subject: string | null | undefined): void {
    authSubject.value = subject
  }

  function lineageKey(workspaceId: string, draftKey: string): string {
    return `${workspaceId}:${draftKey}`
  }

  function payloadFor(
    workspaceId: string,
    draftKey: string,
    data: string,
    updatedAt: number
  ): DraftPayloadV2 {
    const lineage =
      lineageByDraft.get(lineageKey(workspaceId, draftKey)) ??
      readPayload(workspaceId, draftKey)?.lineage
    return { data, updatedAt, ...(lineage && { lineage }) }
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

  function commitDraftIndex(
    index: DraftIndexV2,
    previousIndex: DraftIndexV2,
    draftKey: string,
    previousPayload: DraftPayloadV2 | null
  ): boolean {
    let written = false
    try {
      written = persistIndex(index)
      return written
    } finally {
      if (!written) {
        const workspaceId = currentWorkspaceId()
        if (previousPayload)
          writePayload(workspaceId, draftKey, previousPayload)
        else deletePayload(workspaceId, draftKey)
        persistIndex(previousIndex)
      }
    }
  }

  function saveDraft(
    path: string,
    data: string,
    meta: DraftMeta,
    { evict = true, minUpdatedAt = 0 } = {}
  ): boolean {
    if (!isStorageAvailable()) return false

    const workspaceId = currentWorkspaceId()
    const draftKey = hashPath(path)
    const now = Math.max(Date.now(), minUpdatedAt)

    const index = evict
      ? loadIndex()
      : (readIndex(workspaceId) ?? createEmptyIndex())
    const draftId = lineageKey(workspaceId, draftKey)
    const { index: newIndex } = upsertEntry(
      index,
      path,
      { ...meta, updatedAt: now },
      Number.POSITIVE_INFINITY
    )
    const previousPayload = readPayload(workspaceId, draftKey)

    const payloadWritten = writePayload(
      workspaceId,
      draftKey,
      payloadFor(workspaceId, draftKey, data, now)
    )

    if (!payloadWritten) {
      reportQuotaExhausted(draftId, index, payloadByteSize(data), 'payload')
      return false
    }

    if (!commitDraftIndex(newIndex, index, draftKey, previousPayload)) {
      reportQuotaExhausted(draftId, index, payloadByteSize(data), 'index')
      return false
    }

    reportedQuotaByDraft.delete(draftId)
    return true
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

  function reportQuotaExhausted(
    draftId: string,
    index: DraftIndexV2,
    payloadBytes: number,
    writeTarget: 'payload' | 'index'
  ): void {
    if (reportedQuotaByDraft.has(draftId)) return
    reportedQuotaByDraft.add(draftId)

    reportError(
      new Error('localStorage quota exhausted while saving workflow draft'),
      {
        surface: 'graph',
        errorType: 'storage_quota_exhausted',
        level: 'warning',
        tags: { store: 'workflowDraftStoreV2' },
        context: {
          evictedDrafts: 0,
          remainingDrafts: index.order.length,
          incomingPayloadBytes: payloadBytes,
          writeTarget
        }
      }
    )
  }

  /**
   * Removes a draft.
   */
  function removeDraft(path: string): void {
    const workspaceId = currentWorkspaceId()
    const draftId = lineageKey(workspaceId, hashPath(path))
    const index = loadIndex()
    const { index: newIndex, removedKey } = removeEntry(index, path)

    reportedQuotaByDraft.delete(draftId)

    if (removedKey) {
      deletePayload(workspaceId, removedKey)
      lineageByDraft.delete(lineageKey(workspaceId, removedKey))
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
      const isRenameOntoSelf = result.oldKey === result.newKey
      if (isRenameOntoSelf) {
        persistIndex(result.index)
        reportedQuotaByDraft.delete(lineageKey(workspaceId, result.oldKey))
        return
      }
      const oldPayload = readPayload(workspaceId, result.oldKey)
      if (oldPayload) {
        const written = writePayload(workspaceId, result.newKey, oldPayload)
        if (!written) return

        if (!persistIndex(result.index)) {
          deletePayload(workspaceId, result.newKey)
          return
        }
        reportedQuotaByDraft.delete(lineageKey(workspaceId, result.oldKey))
        reportedQuotaByDraft.delete(lineageKey(workspaceId, result.newKey))
        deletePayload(workspaceId, result.oldKey)
        const lineage = lineageByDraft.get(
          lineageKey(workspaceId, result.oldKey)
        )
        if (lineage) {
          lineageByDraft.set(lineageKey(workspaceId, result.newKey), lineage)
          lineageByDraft.delete(lineageKey(workspaceId, result.oldKey))
        }
      }
    }
  }

  function getDraft(
    path: string,
    { fresh = false } = {}
  ): {
    data: string
    name: string
    isTemporary: boolean
    updatedAt: number
    lineage?: DraftLineage
  } | null {
    const workspaceId = currentWorkspaceId()
    const index = fresh ? readIndex(workspaceId) : loadIndex()
    if (!index) return null
    const entry = getEntryByPath(index, path)
    if (entry?.path !== path) return null

    const draftKey = hashPath(path)
    if (!index.order.includes(draftKey)) return null
    const payload = readPayload(workspaceId, draftKey)
    if (!payload) {
      if (!fresh) removeDraft(path)
      return null
    }
    if (payload.lineage)
      lineageByDraft.set(lineageKey(workspaceId, draftKey), payload.lineage)

    return {
      data: payload.data,
      name: entry.name,
      isTemporary: entry.isTemporary,
      updatedAt: payload.updatedAt,
      lineage: payload.lineage
    }
  }

  function setLineage(path: string, lineage: DraftLineage): void {
    const workspaceId = currentWorkspaceId()
    const draftKey = hashPath(path)
    lineageByDraft.set(lineageKey(workspaceId, draftKey), lineage)
    const payload = readPayload(workspaceId, draftKey)
    if (
      payload &&
      (payload.lineage?.workflowId !== lineage.workflowId ||
        payload.lineage.lineageSeq !== lineage.lineageSeq)
    )
      writePayload(workspaceId, draftKey, { ...payload, lineage })
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

  async function tryLoadGraph(
    payload: string | null,
    workflowName: string | null,
    isCurrent?: () => boolean,
    onFailure?: () => void
  ): Promise<boolean> {
    if (!payload) return false
    try {
      const workflow = JSON.parse(payload)
      if (isCurrent?.() === false) return false
      await useApp().loadGraphData(workflow, true, true, workflowName)
      return true
    } catch (err) {
      console.error('Failed to load persisted workflow', err)
      onFailure?.()
      return false
    }
  }

  async function loadDraft(
    path: string,
    isCurrent?: () => boolean
  ): Promise<boolean> {
    const draft = getDraft(path)
    if (!draft) return false

    const loaded = await tryLoadGraph(draft.data, draft.name, isCurrent, () => {
      removeDraft(path)
    })
    if (loaded) {
      markDraftUsed(path)
    }

    return loaded
  }

  async function loadPersistedWorkflow(
    options: LoadPersistedWorkflowOptions
  ): Promise<boolean> {
    const { preferredPath, fallbackToLatestDraft = false, isCurrent } = options

    if (preferredPath && (await loadDraft(preferredPath, isCurrent))) {
      return true
    }

    if (fallbackToLatestDraft && isCurrent?.() !== false) {
      const mostRecent = getMostRecentPath()
      if (mostRecent && (await loadDraft(mostRecent, isCurrent))) {
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
    for (const key of lineageByDraft.keys()) {
      if (key.startsWith(`${workspaceId}:`)) lineageByDraft.delete(key)
    }
    for (const key of reportedQuotaByDraft) {
      if (key.startsWith(`${workspaceId}:`)) reportedQuotaByDraft.delete(key)
    }
  }

  return {
    setAuthSubject,
    getScope: currentWorkspaceId,
    saveDraft,
    removeDraft,
    moveDraft,
    markDraftUsed,
    getDraft,
    setLineage,
    getMostRecentPath,
    loadPersistedWorkflow,
    reset
  }
})
