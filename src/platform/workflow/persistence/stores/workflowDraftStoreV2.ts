/**
 * V2 Workflow Draft Store
 *
 * Uses per-draft keys in localStorage instead of a single blob.
 * Handles LRU eviction and quota management.
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'

import { reportError } from '@comfyorg/telemetry/reportError'
import { useApp } from '@/scripts/appInstance'

import type {
  DraftIndexV2,
  DraftLineage,
  DraftPayloadV2
} from '@/platform/workflow/persistence/base/draftTypes'
import { MAX_DRAFTS } from '@/platform/workflow/persistence/base/draftTypes'
import {
  createEmptyIndex,
  getEntryByPath,
  getMostRecentKey,
  removeEntry,
  removeOrphanedEntries,
  resolveDraftKey,
  retargetEntry,
  touchOrder,
  upsertEntry
} from '@/platform/workflow/persistence/base/draftCacheV2'
import { getWorkspaceId } from '@/platform/workflow/persistence/base/storageKeys'
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
} from '@/platform/workflow/persistence/base/storageIO'

interface DraftMeta {
  name: string
  isTemporary: boolean
}

/**
 * A draft relocation that has been admitted but not performed. Pass to
 * `commitDraftRelocation` once the operation it accompanies has committed; a
 * handle that is never committed has nothing to clean up, because staging
 * writes nothing.
 */
export interface StagedDraftRelocation {
  /**
   * The persistence scope the relocation was staged in. Carried on the handle
   * so completion cannot drift onto another account's drafts when the
   * authenticated subject changes mid-operation.
   */
  readonly workspaceId: string
  readonly oldPath: string
  readonly newPath: string
  readonly name: string
}

type StageDraftRelocationResult =
  | { kind: 'staged'; relocation: StagedDraftRelocation }
  | { kind: 'refused' }

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

  function deleteLineages(workspaceId: string, draftKeys: string[]): void {
    for (const draftKey of draftKeys)
      lineageByDraft.delete(lineageKey(workspaceId, draftKey))
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
  function loadIndex(workspaceId: string = currentWorkspaceId()): DraftIndexV2 {
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
  function persistIndex(
    index: DraftIndexV2,
    workspaceId: string = currentWorkspaceId()
  ): boolean {
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
    const now = Date.now()

    const index = loadIndex()
    const draftKey = resolveDraftKey(index, path)

    const payloadWritten = writePayload(
      workspaceId,
      draftKey,
      payloadFor(workspaceId, draftKey, data, now)
    )

    if (!payloadWritten) {
      return handleQuotaExceeded(path, data, meta)
    }
    const { index: newIndex, evicted } = upsertEntry(
      index,
      path,
      { ...meta, updatedAt: now },
      MAX_DRAFTS,
      draftKey
    )

    if (!persistIndex(newIndex)) {
      deletePayload(workspaceId, draftKey)
      persistIndex(index)
      return false
    }

    deletePayloads(workspaceId, evicted)
    deleteLineages(workspaceId, evicted)
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
    let currentIndex = loadIndex()
    const draftKey = resolveDraftKey(currentIndex, path)
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
        deleteLineages(workspaceId, [result.removedKey])
        evictedCount++
      }

      const now = Date.now()
      if (
        writePayload(
          workspaceId,
          draftKey,
          payloadFor(workspaceId, draftKey, data, now)
        )
      ) {
        const { index: finalIndex } = upsertEntry(
          currentIndex,
          path,
          { ...meta, updatedAt: now },
          MAX_DRAFTS,
          draftKey
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
        surface: 'graph',
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
      lineageByDraft.delete(lineageKey(workspaceId, removedKey))
      persistIndex(newIndex)
    }
  }

  function reportRelocationFailure(
    errorType: string,
    message: string,
    oldPath: string,
    newPath: string
  ): void {
    reportError(new Error(message), {
      surface: 'graph',
      errorType,
      level: 'warning',
      tags: { store: 'workflowDraftStoreV2' },
      context: { oldPath, newPath }
    })
  }

  /**
   * Admits a draft relocation without performing it.
   *
   * Phase one of an ordering that needs no rollback, and it writes nothing at
   * all. A relocation re-points one index entry and never copies a payload
   * (`retargetEntry`), so there is no destination to reserve and no source to
   * protect: a caller that stages and then abandons its rename leaves storage
   * exactly as it found it. Staging exists only so a relocation that cannot be
   * completed is refused *before* the remote step it accompanies happens,
   * rather than after the file has already moved.
   *
   * The admission test is `retargetEntry` itself rather than a restatement of
   * its preconditions, so staging and committing cannot disagree about what is
   * relocatable.
   *
   * @returns `refused` when `newPath` already has its own draft — nothing was
   * touched and the caller must not proceed with the operation this
   * accompanies. Otherwise a handle for `commitDraftRelocation`.
   */
  function stageDraftRelocation(
    oldPath: string,
    newPath: string,
    name: string
  ): StageDraftRelocationResult {
    const workspaceId = currentWorkspaceId()
    const index = loadIndex(workspaceId)
    const staged: StageDraftRelocationResult = {
      kind: 'staged',
      relocation: { workspaceId, oldPath, newPath, name }
    }

    // Nothing to relocate up front. The caller still commits, because a draft
    // can be written at `oldPath` while its rename is in flight.
    if (!getEntryByPath(index, oldPath)) return staged

    if (!retargetEntry(index, oldPath, newPath, name))
      return { kind: 'refused' }
    return staged
  }

  /**
   * Completes a staged relocation, in the scope it was staged in.
   *
   * Runs only once the step this relocation accompanies has committed. The
   * index is deliberately re-read rather than carried on the handle, because a
   * draft persisted while a rename was in flight writes to `oldPath` —
   * `workflow.path` is the old path until the request resolves — and that
   * advances the index. Re-reading is also what carries that newer draft
   * forward for free: the in-flight write landed on the very key this entry
   * names, so re-pointing the entry associates `newPath` with the newest bytes
   * by construction. There is no copy to refresh and so no refresh to refuse.
   *
   * Every read and write uses the handle's `workspaceId` rather than the
   * current one: an account transition during the await must not let account
   * A's relocation touch account B's drafts, and A's draft must still follow
   * A's file.
   *
   * @returns false when the draft was not relocated, which leaves it readable
   * at `oldPath` — either because `newPath` acquired its own draft during the
   * window, or because the index could not be written at all. Nothing is
   * destroyed in either case.
   */
  function commitDraftRelocation(relocation: StagedDraftRelocation): boolean {
    const { workspaceId, oldPath, newPath, name } = relocation
    const index = loadIndex(workspaceId)

    // The source was discarded during the window (workflow closed or deleted).
    // There is nothing to revive: the user let the draft go.
    if (!getEntryByPath(index, oldPath)) return true

    const retargeted = retargetEntry(index, oldPath, newPath, name)
    if (!retargeted) {
      reportRelocationFailure(
        'rename_draft_relocation_commit_refused',
        'the draft destination was no longer available at commit',
        oldPath,
        newPath
      )
      return false
    }

    if (persistIndex(retargeted, workspaceId)) return true

    persistIndex(index, workspaceId)
    reportRelocationFailure(
      'rename_draft_relocation_commit_failed',
      'could not persist a relocated draft index',
      oldPath,
      newPath
    )
    return false
  }

  /**
   * Moves a draft from one path to another (rename).
   *
   * Stages and immediately commits, which is only safe because nothing can
   * intervene between the two. Where a remote request sits between them, stage
   * and commit explicitly so the relocation is admitted before the request and
   * completed after it.
   *
   * @returns false when the source draft could not be relocated (left
   * recoverable at `oldPath`); true otherwise, including when there was
   * nothing to move.
   */
  function moveDraft(oldPath: string, newPath: string, name: string): boolean {
    const staged = stageDraftRelocation(oldPath, newPath, name)
    if (staged.kind === 'refused') return false
    return commitDraftRelocation(staged.relocation)
  }

  /**
   * Gets draft data by path.
   */
  function getDraft(path: string): {
    data: string
    name: string
    isTemporary: boolean
    updatedAt: number
    lineage?: DraftLineage
  } | null {
    const workspaceId = currentWorkspaceId()
    const index = loadIndex()
    const entry = getEntryByPath(index, path)
    if (!entry) return null

    const draftKey = resolveDraftKey(index, path)
    const payload = readPayload(workspaceId, draftKey)
    if (!payload) {
      removeDraft(path)
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
    const index = loadIndex()
    const draftKey = resolveDraftKey(index, path)
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

    const draftKey = resolveDraftKey(index, path)
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
  }

  return {
    setAuthSubject,
    saveDraft,
    removeDraft,
    moveDraft,
    stageDraftRelocation,
    commitDraftRelocation,
    markDraftUsed,
    getDraft,
    setLineage,
    getMostRecentPath,
    loadPersistedWorkflow,
    reset
  }
})
