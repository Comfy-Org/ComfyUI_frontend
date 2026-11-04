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
  moveEntry,
  removeEntry,
  removeOrphanedEntries,
  resolveDraftKey,
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
 * A draft relocation whose destination is reserved and whose source is still
 * intact. Pass to exactly one of `commitDraftRelocation` (the accompanying
 * operation committed) or `abortDraftRelocation` (it did not).
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
  /** Destination key holding the reserved copy, when one was written. */
  readonly prewrittenKey: string | null
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

  /**
   * Writes the relocated payload for a move, evicting unrelated drafts to
   * free quota and retrying the move against the resulting index.
   * Returns null if a retry finds the destination has since become
   * occupied; otherwise the (possibly evicted) index, the latest move
   * result, whether the write ultimately succeeded, and how many drafts
   * were evicted along the way.
   */
  function writeRelocatedPayload(
    workspaceId: string,
    oldPath: string,
    newPath: string,
    name: string,
    index: DraftIndexV2,
    result: NonNullable<ReturnType<typeof moveEntry>>,
    oldPayload: DraftPayloadV2
  ): {
    index: DraftIndexV2
    result: NonNullable<ReturnType<typeof moveEntry>>
    written: boolean
    evictedCount: number
  } | null {
    let written = writePayload(workspaceId, result.newKey, oldPayload)
    let evictedCount = 0

    while (!written) {
      const oldestKey = index.order.find(
        (key) => key !== result.oldKey && key !== result.newKey
      )
      if (!oldestKey) break

      const oldestEntry = getIndexEntry(index, oldestKey)
      if (!oldestEntry) {
        index = stripOrderKey(index, oldestKey)
        continue
      }

      const evicted = removeEntry(index, oldestEntry.path)
      index = evicted.index
      if (evicted.removedKey) {
        deletePayload(workspaceId, evicted.removedKey)
        deleteLineages(workspaceId, [evicted.removedKey])
        evictedCount++
      }

      const retried = moveEntry(index, oldPath, newPath, name)
      if (!retried) return null
      result = retried
      written = writePayload(workspaceId, result.newKey, oldPayload)
    }

    return { index, result, written, evictedCount }
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
   * Reserves a draft relocation's destination without destroying its source.
   *
   * Phase one of the only ordering that needs no rollback. The fallible half of
   * a relocation is allocating the destination payload, which quota can refuse;
   * the destructive half is removing the source. Doing them in that order means
   * a refusal is reported while the draft is still wholly intact at `oldPath`,
   * so a caller that then abandons its rename has nothing to undo — and
   * `abortDraftRelocation` therefore cannot fail in a way that loses data.
   *
   * Between staging and committing, storage holds two copies of the draft and
   * an index that still resolves `oldPath`. That is the correct view for a
   * reload during a remote rename that has not resolved yet: the file has not
   * moved either.
   *
   * @returns `refused` when the destination could not be reserved — nothing was
   * destroyed and the caller must not proceed with the operation this
   * accompanies. Otherwise a handle for exactly one of
   * `commitDraftRelocation` or `abortDraftRelocation`.
   */
  function stageDraftRelocation(
    oldPath: string,
    newPath: string,
    name: string
  ): StageDraftRelocationResult {
    const workspaceId = currentWorkspaceId()
    const index = loadIndex(workspaceId)
    const staged = (
      prewrittenKey: string | null
    ): StageDraftRelocationResult => ({
      kind: 'staged',
      relocation: { workspaceId, oldPath, newPath, name, prewrittenKey }
    })

    // Nothing to relocate up front. The caller still commits, because a draft
    // can be written at `oldPath` while its rename is in flight.
    if (!getEntryByPath(index, oldPath)) return staged(null)

    const result = moveEntry(index, oldPath, newPath, name)
    if (!result) return { kind: 'refused' }
    // A rename resolving onto its own draft key needs no second payload.
    if (result.oldKey === result.newKey) return staged(null)

    const oldPayload = readPayload(workspaceId, result.oldKey)
    if (!oldPayload) return staged(null)

    const relocated = writeRelocatedPayload(
      workspaceId,
      oldPath,
      newPath,
      name,
      index,
      result,
      oldPayload
    )
    if (!relocated) return { kind: 'refused' }

    // Evictions made to free room have already deleted their payloads, so the
    // index must record them either way. The source entry is untouched by them.
    if (relocated.evictedCount > 0) persistIndex(relocated.index, workspaceId)

    if (!relocated.written) {
      reportQuotaExhausted(
        relocated.index,
        relocated.evictedCount,
        payloadByteSize(oldPayload.data)
      )
      return { kind: 'refused' }
    }
    return staged(relocated.result.newKey)
  }

  /**
   * Completes a staged relocation, in the scope it was staged in.
   *
   * Runs only once the step this relocation accompanies has committed, so the
   * source removal below is the single destructive act in the whole operation
   * and no outcome remains that could require undoing it.
   *
   * Two things are deliberately re-read from storage rather than carried on the
   * handle. The index, because a draft persisted while a rename was in flight
   * writes to `oldPath` — `workflow.path` is the old path until the request
   * resolves — and that advances the index. The destination payload, because
   * comparing against what is actually stored cannot disagree with reality,
   * where a timestamp captured at stage time can.
   *
   * Every read and write uses the handle's `workspaceId` rather than the
   * current one: an account transition during the await must not let account
   * A's relocation touch account B's drafts, and A's draft must still follow
   * A's file.
   */
  function commitDraftRelocation(relocation: StagedDraftRelocation): boolean {
    const { workspaceId, oldPath, newPath, name, prewrittenKey } = relocation
    const index = loadIndex(workspaceId)
    const dropReservedCopy = () => {
      if (prewrittenKey) deletePayload(workspaceId, prewrittenKey)
    }

    // The source was discarded during the window (workflow closed or deleted).
    // Drop the reserved copy rather than revive a draft the user let go.
    if (!getEntryByPath(index, oldPath)) {
      dropReservedCopy()
      return true
    }

    const moved = moveEntry(index, oldPath, newPath, name)
    if (!moved) {
      dropReservedCopy()
      reportRelocationFailure(
        'rename_draft_relocation_commit_refused',
        'the draft destination was no longer available at commit',
        oldPath,
        newPath
      )
      return false
    }

    const sameKey = moved.oldKey === moved.newKey
    if (!sameKey && !refreshRelocatedPayload(workspaceId, moved)) {
      reportRelocationFailure(
        'rename_draft_carry_forward_failed',
        'could not carry a draft onto the relocated path',
        oldPath,
        newPath
      )
      return false
    }

    if (!persistIndex(moved.index, workspaceId)) {
      persistIndex(index, workspaceId)
      reportRelocationFailure(
        'rename_draft_relocation_commit_failed',
        'could not persist a relocated draft index',
        oldPath,
        newPath
      )
      return false
    }

    if (!sameKey) reapRelocationSource(workspaceId, moved)
    return true
  }

  /**
   * Brings the destination copy up to date with the source before the source is
   * removed.
   *
   * Staleness is decided on content rather than on `updatedAt`: the only writer
   * to the source during a relocation's window is `persistActiveWorkflowDraft`,
   * so any difference means the source is the newer draft — and a write landing
   * in the same millisecond as the reserved copy is a real edit that a
   * timestamp comparison would silently drop.
   *
   * @returns false when the destination is absent or stale and cannot be
   * refreshed, which must leave the draft at its source rather than replace a
   * newer draft with an older one or with nothing.
   */
  function refreshRelocatedPayload(
    workspaceId: string,
    moved: NonNullable<ReturnType<typeof moveEntry>>
  ): boolean {
    const source = readPayload(workspaceId, moved.oldKey)
    if (!source) return true

    const destination = readPayload(workspaceId, moved.newKey)
    const isCurrent =
      destination &&
      destination.data === source.data &&
      destination.updatedAt === source.updatedAt
    if (isCurrent) return true

    if (writePayload(workspaceId, moved.newKey, source)) return true
    if (!destination) deletePayload(workspaceId, moved.newKey)
    return false
  }

  /**
   * Removes a committed relocation's source payload and carries its lineage
   * across. The single destructive step of a relocation, reached only once the
   * operation it accompanies has committed and the destination is in place.
   */
  function reapRelocationSource(
    workspaceId: string,
    moved: NonNullable<ReturnType<typeof moveEntry>>
  ): void {
    deletePayload(workspaceId, moved.oldKey)
    const lineage = lineageByDraft.get(lineageKey(workspaceId, moved.oldKey))
    if (!lineage) return
    lineageByDraft.set(lineageKey(workspaceId, moved.newKey), lineage)
    lineageByDraft.delete(lineageKey(workspaceId, moved.oldKey))
  }

  /**
   * Abandons a staged relocation, in the scope it was staged in.
   *
   * Removes only the copy the relocation itself reserved, so unlike a reverse
   * move it allocates nothing and has no refusal to report — the draft and its
   * index entry were never touched. A failed delete leaves an unreferenced
   * payload, which `loadIndex` reaps as index/payload drift.
   */
  function abortDraftRelocation(relocation: StagedDraftRelocation): void {
    if (relocation.prewrittenKey)
      deletePayload(relocation.workspaceId, relocation.prewrittenKey)
  }

  /**
   * Moves a draft from one path to another (rename).
   *
   * Stages and immediately commits, which is only safe because nothing can
   * intervene between the two. Where a remote request sits between them, stage
   * and commit explicitly so a rejection has nothing to roll back.
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
    abortDraftRelocation,
    markDraftUsed,
    getDraft,
    setLineage,
    getMostRecentPath,
    loadPersistedWorkflow,
    reset
  }
})
