import { defineStore } from 'pinia'

import { useSettingStore } from '@/platform/settings/settingStore'
import { reportError } from '@/platform/telemetry/reportError'
import { isStorageAvailable } from '@/platform/workflow/persistence/base/storageIO'
import {
  StorageKeys,
  getWorkspaceId
} from '@/platform/workflow/persistence/base/storageKeys'

/**
 * Both bounds exist to cap the origin budget, not because a thread stops
 * wanting its graph — these entries compete with `workflowDraftStoreV2`'s 32
 * live drafts for the same ~5MB. Past either bound recovery simply misses and
 * the chat reports the workflow unavailable, exactly as it did before this
 * archive existed. The TTL matches the agent binding TTL for consistency
 * within the subsystem. Recency is the close time rather than the read time,
 * so what survives is what the user had open most recently.
 */
const ARCHIVE_TTL_MS = 30 * 24 * 60 * 60 * 1000
const MAX_ARCHIVED_DRAFTS = 16

type WriteOutcome = 'stored' | 'over-quota' | 'refused'

interface ArchiveEntry {
  filename: string
  archivedAt: number
}

type ArchiveIndex = Record<string, ArchiveEntry>

export interface ArchivedWorkflowDraft extends ArchiveEntry {
  content: string
}

function isArchiveEntry(value: unknown): value is ArchiveEntry {
  if (typeof value !== 'object' || value === null) return false
  const { filename, archivedAt } = value as Record<string, unknown>
  return typeof filename === 'string' && typeof archivedAt === 'number'
}

function parseIndex(raw: string | null): ArchiveIndex {
  try {
    const parsed: unknown = JSON.parse(raw ?? 'null')
    if (typeof parsed !== 'object' || parsed === null) return {}
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, ArchiveEntry] =>
        isArchiveEntry(entry[1])
      )
    )
  } catch {
    return {}
  }
}

function isLive(entry: ArchiveEntry, now: number): boolean {
  return entry.archivedAt + ARCHIVE_TTL_MS >= now
}

function oldestFirst(index: ArchiveIndex): string[] {
  return Object.entries(index)
    .sort(([, a], [, b]) => a.archivedAt - b.archivedAt)
    .map(([workflowId]) => workflowId)
}

function isQuotaExceeded(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === 'QuotaExceededError' ||
      error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      error.code === 22 ||
      error.code === 1014)
  )
}

function write(key: string, value: string): WriteOutcome {
  if (!isStorageAvailable()) return 'refused'
  try {
    localStorage.setItem(key, value)
    return 'stored'
  } catch (error) {
    return isQuotaExceeded(error) ? 'over-quota' : 'refused'
  }
}

/**
 * Keeps the graph of an unsaved workflow that an agent chat thread is pinned
 * to, so closing its tab does not strand the thread.
 *
 * Closing a tab is destructive by design: `workflowStore.closeWorkflow` drops
 * a temporary workflow from the store and deletes its `workflowDraftStoreV2`
 * draft, which leaves a historical chat with nothing to reopen. Only tabs the
 * agent is bound to are archived, so the cost is bounded by how many workflows
 * chat has touched rather than by how many tabs the user closes.
 */
export const useAgentWorkflowDraftArchiveStore = defineStore(
  'agentWorkflowDraftArchive',
  () => {
    function readIndex(workspaceId: string): ArchiveIndex {
      try {
        return parseIndex(
          localStorage.getItem(StorageKeys.agentDraftArchiveIndex(workspaceId))
        )
      } catch {
        return {}
      }
    }

    function writeIndex(workspaceId: string, index: ArchiveIndex): boolean {
      return (
        write(
          StorageKeys.agentDraftArchiveIndex(workspaceId),
          JSON.stringify(index)
        ) === 'stored'
      )
    }

    function readPayload(
      workspaceId: string,
      workflowId: string
    ): string | null {
      try {
        return localStorage.getItem(
          StorageKeys.agentDraftArchivePayload(workspaceId, workflowId)
        )
      } catch {
        return null
      }
    }

    function writePayload(
      workspaceId: string,
      workflowId: string,
      content: string
    ): WriteOutcome {
      return write(
        StorageKeys.agentDraftArchivePayload(workspaceId, workflowId),
        content
      )
    }

    function evict(
      workspaceId: string,
      index: ArchiveIndex,
      workflowIds: string[]
    ): ArchiveIndex {
      const remaining = { ...index }
      for (const workflowId of workflowIds) {
        delete remaining[workflowId]
        try {
          localStorage.removeItem(
            StorageKeys.agentDraftArchivePayload(workspaceId, workflowId)
          )
        } catch {
          // Losing one payload does not invalidate the rest of the sweep.
        }
      }
      return remaining
    }

    function reportQuotaExhausted(content: string): void {
      reportError(
        new Error('localStorage quota exhausted archiving agent draft'),
        {
          errorType: 'storage_quota_exhausted',
          level: 'warning',
          tags: { store: 'agentWorkflowDraftArchive' },
          context: {
            contentBytes: new TextEncoder().encode(content).length
          }
        }
      )
    }

    /**
     * Deletes payloads the index no longer names. Nothing else enumerates
     * these keys, so a payload orphaned by a corrupt index or a half-applied
     * write would otherwise hold its share of the origin budget forever and
     * push `workflowDraftStoreV2` toward the quota path.
     */
    function sweepOrphanPayloads(
      workspaceId: string,
      index: ArchiveIndex
    ): void {
      const prefix = `${StorageKeys.prefixes.agentDraftArchivePayload}${workspaceId}:`
      try {
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const key = localStorage.key(i)
          if (key === null || !key.startsWith(prefix)) continue
          if (!Object.hasOwn(index, key.slice(prefix.length)))
            localStorage.removeItem(key)
        }
      } catch {
        return
      }
    }

    function persistenceEnabled(): boolean {
      return useSettingStore().get('Comfy.Workflow.Persist')
    }

    /**
     * Archives `content` under `workflowId`, dropping expired entries and then
     * the oldest graphs until the write fits. Returns `false` once eviction is
     * exhausted or storage refuses the write outright, leaving a smaller
     * archive rather than an index promising payloads it no longer has.
     *
     * Only a quota rejection evicts: any other refusal would clear the archive
     * without freeing what is actually blocking. The previous copy of this
     * workflow is never removed up front either — the write overwrites that
     * key anyway, so removing it early would only turn a failed write into a
     * lost snapshot.
     */
    function archive(
      workflowId: string,
      draft: { filename: string; content: string }
    ): boolean {
      if (!persistenceEnabled()) return false
      const workspaceId = getWorkspaceId()
      const now = Date.now()
      const stored = readIndex(workspaceId)
      let index = evict(
        workspaceId,
        stored,
        Object.entries(stored).flatMap(([id, entry]) =>
          id !== workflowId && !isLive(entry, now) ? [id] : []
        )
      )
      const capacity =
        MAX_ARCHIVED_DRAFTS - (Object.hasOwn(index, workflowId) ? 0 : 1)
      const replaceable = () =>
        oldestFirst(index).filter((id) => id !== workflowId)
      index = evict(
        workspaceId,
        index,
        replaceable().slice(
          0,
          Math.max(0, Object.keys(index).length - capacity)
        )
      )

      let outcome = writePayload(workspaceId, workflowId, draft.content)
      while (outcome === 'over-quota') {
        const oldest = replaceable().at(0)
        if (oldest === undefined) {
          reportQuotaExhausted(draft.content)
          break
        }
        index = evict(workspaceId, index, [oldest])
        outcome = writePayload(workspaceId, workflowId, draft.content)
      }
      if (outcome !== 'stored') {
        writeIndex(workspaceId, index)
        sweepOrphanPayloads(workspaceId, index)
        return false
      }

      const updated: ArchiveIndex = {
        ...index,
        [workflowId]: { filename: draft.filename, archivedAt: now }
      }
      if (!writeIndex(workspaceId, updated)) {
        evict(workspaceId, index, [workflowId])
        return false
      }
      sweepOrphanPayloads(workspaceId, updated)
      return true
    }

    function discard(workflowId: string): void {
      const workspaceId = getWorkspaceId()
      const index = readIndex(workspaceId)
      const remaining = evict(workspaceId, index, [workflowId])
      if (Object.hasOwn(index, workflowId)) writeIndex(workspaceId, remaining)
    }

    function read(workflowId: string): ArchivedWorkflowDraft | null {
      if (!persistenceEnabled()) return null
      const workspaceId = getWorkspaceId()
      const index = readIndex(workspaceId)
      if (!Object.hasOwn(index, workflowId)) return null
      const entry = index[workflowId]
      const content = isLive(entry, Date.now())
        ? readPayload(workspaceId, workflowId)
        : null
      if (content === null) {
        discard(workflowId)
        return null
      }
      return { ...entry, content }
    }

    return { archive, read, discard }
  }
)
