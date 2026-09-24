import { defineStore } from 'pinia'

import { useSettingStore } from '@/platform/settings/settingStore'
import { reportError } from '@/platform/telemetry/reportError'
import { isStorageAvailable } from '@/platform/workflow/persistence/base/storageIO'
import {
  StorageKeys,
  getWorkspaceId
} from '@/platform/workflow/persistence/base/storageKeys'

/**
 * These bounds exist to cap the origin budget, not because a thread stops
 * wanting its graph. The archive is a second copy of workflow data sharing
 * ~5MB with `workflowDraftStoreV2`'s live drafts, and unlike those it holds
 * graphs for tabs that are already closed, so nothing else would ever reclaim
 * them. Capping total bytes is what keeps the archive from starving the draft
 * store, whose own quota path ends in `markStorageUnavailable()` and stops
 * persisting unsaved work for the rest of the session.
 *
 * Past any bound recovery simply misses and the chat reports the workflow
 * unavailable, exactly as it did before this archive existed. The TTL matches
 * the agent binding TTL for consistency within the subsystem. Recency is the
 * close time rather than the read time, so what survives is what the user had
 * open most recently.
 */
const ARCHIVE_TTL_MS = 30 * 24 * 60 * 60 * 1000
const MAX_ARCHIVED_DRAFTS = 8
const MAX_ARCHIVE_BYTES = 1_500_000
const MAX_PAYLOAD_BYTES = 500_000

type WriteOutcome = 'stored' | 'over-quota' | 'refused'

interface ArchiveEntry {
  filename: string
  archivedAt: number
  bytes: number
}

type ArchiveIndex = Record<string, ArchiveEntry>

export interface ArchivedWorkflowDraft extends ArchiveEntry {
  content: string
}

function isArchiveEntry(value: unknown): value is ArchiveEntry {
  if (typeof value !== 'object' || value === null) return false
  const { filename, archivedAt, bytes } = value as Record<string, unknown>
  return (
    typeof filename === 'string' &&
    typeof archivedAt === 'number' &&
    typeof bytes === 'number'
  )
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

function oldestFirst(index: ArchiveIndex, except?: string): string[] {
  return Object.entries(index)
    .sort(([, a], [, b]) => a.archivedAt - b.archivedAt)
    .flatMap(([workflowId]) => (workflowId === except ? [] : [workflowId]))
}

function byteLength(content: string): number {
  return new TextEncoder().encode(content).length
}

/**
 * The entries that must go before `incoming` fits under both the count and the
 * byte budget, oldest first. The workflow being archived is never a candidate:
 * its payload key is about to be overwritten, so dropping it frees nothing.
 */
function overBudget(
  index: ArchiveIndex,
  workflowId: string,
  incoming: number
): string[] {
  const entries = Object.entries(index)
  const replaced = Object.hasOwn(index, workflowId)
    ? index[workflowId].bytes
    : 0
  let count = entries.length + (replaced > 0 ? 0 : 1)
  let bytes =
    entries.reduce((total, [, entry]) => total + entry.bytes, 0) -
    replaced +
    incoming
  const evicted: string[] = []
  for (const candidate of oldestFirst(index, workflowId)) {
    if (count <= MAX_ARCHIVED_DRAFTS && bytes <= MAX_ARCHIVE_BYTES) break
    evicted.push(candidate)
    count -= 1
    bytes -= index[candidate].bytes
  }
  return evicted
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

    function reportArchiveRefused(
      reason: 'quota_exhausted' | 'payload_too_large',
      workflowId: string,
      bytes: number
    ): void {
      reportError(new Error(`agent draft archive refused: ${reason}`), {
        errorType: 'storage_quota_exhausted',
        level: 'warning',
        tags: { store: 'agentWorkflowDraftArchive' },
        context: { reason, workflowId, contentBytes: bytes }
      })
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
     * the oldest graphs until the incoming one fits the count and byte budgets.
     * Returns `false` when the graph is too large to archive at all or storage
     * refuses the write, leaving a smaller archive rather than an index
     * promising payloads it no longer has.
     *
     * A browser quota rejection means the whole origin is full, not that this
     * archive is over budget, so it frees at most about what the incoming
     * graph needs. Evicting the rest would destroy every other thread's
     * recovery data to store one graph — and still fail if the pressure is
     * coming from elsewhere. The previous copy of this workflow is never
     * removed up front either: the write overwrites that key anyway, so
     * removing it early would only turn a failed write into a lost snapshot.
     */
    function archive(
      workflowId: string,
      draft: { filename: string; content: string }
    ): boolean {
      if (!persistenceEnabled()) return false
      const bytes = byteLength(draft.content)
      if (bytes > MAX_PAYLOAD_BYTES) {
        reportArchiveRefused('payload_too_large', workflowId, bytes)
        return false
      }
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
      index = evict(workspaceId, index, overBudget(index, workflowId, bytes))

      let freed = 0
      let outcome = writePayload(workspaceId, workflowId, draft.content)
      while (outcome === 'over-quota' && freed < bytes) {
        const oldest = oldestFirst(index, workflowId).at(0)
        if (oldest === undefined) break
        freed += index[oldest].bytes
        index = evict(workspaceId, index, [oldest])
        outcome = writePayload(workspaceId, workflowId, draft.content)
      }
      if (outcome !== 'stored') {
        if (outcome === 'over-quota')
          reportArchiveRefused('quota_exhausted', workflowId, bytes)
        writeIndex(workspaceId, index)
        sweepOrphanPayloads(workspaceId, index)
        return false
      }

      const updated: ArchiveIndex = {
        ...index,
        [workflowId]: { filename: draft.filename, archivedAt: now, bytes }
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
