import { defineStore } from 'pinia'

import { reportError } from '@/platform/telemetry/reportError'
import {
  StorageKeys,
  getWorkspaceId
} from '@/platform/workflow/persistence/base/storageKeys'

const ARCHIVE_TTL_MS = 30 * 24 * 60 * 60 * 1000
const MAX_ARCHIVED_DRAFTS = 8

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
      try {
        localStorage.setItem(
          StorageKeys.agentDraftArchiveIndex(workspaceId),
          JSON.stringify(index)
        )
        return true
      } catch {
        return false
      }
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
    ): boolean {
      try {
        localStorage.setItem(
          StorageKeys.agentDraftArchivePayload(workspaceId, workflowId),
          content
        )
        return true
      } catch {
        return false
      }
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
          continue
        }
      }
      return remaining
    }

    function reportQuotaExhausted(contentBytes: number): void {
      reportError(
        new Error('localStorage quota exhausted archiving agent draft'),
        {
          errorType: 'storage_quota_exhausted',
          level: 'warning',
          tags: { store: 'agentWorkflowDraftArchive' },
          context: { contentBytes }
        }
      )
    }

    /**
     * Archives `content` under `workflowId`, dropping expired entries and then
     * the least recently archived graphs until the write fits. Returns `false`
     * once eviction is exhausted, which leaves a smaller archive rather than an
     * index promising payloads it no longer has.
     */
    function archive(
      workflowId: string,
      draft: { filename: string; content: string }
    ): boolean {
      const workspaceId = getWorkspaceId()
      const now = Date.now()
      const stored = readIndex(workspaceId)
      let index = evict(
        workspaceId,
        stored,
        Object.entries(stored).flatMap(([id, entry]) =>
          id === workflowId || !isLive(entry, now) ? [id] : []
        )
      )
      index = evict(
        workspaceId,
        index,
        oldestFirst(index).slice(
          0,
          Math.max(0, Object.keys(index).length - (MAX_ARCHIVED_DRAFTS - 1))
        )
      )

      while (!writePayload(workspaceId, workflowId, draft.content)) {
        const oldest = oldestFirst(index).at(0)
        if (oldest === undefined) {
          reportQuotaExhausted(draft.content.length)
          writeIndex(workspaceId, index)
          return false
        }
        index = evict(workspaceId, index, [oldest])
      }

      if (
        writeIndex(workspaceId, {
          ...index,
          [workflowId]: { filename: draft.filename, archivedAt: now }
        })
      )
        return true

      evict(workspaceId, index, [workflowId])
      return false
    }

    function discard(workflowId: string): void {
      const workspaceId = getWorkspaceId()
      const index = readIndex(workspaceId)
      const remaining = evict(workspaceId, index, [workflowId])
      if (Object.hasOwn(index, workflowId)) writeIndex(workspaceId, remaining)
    }

    function read(workflowId: string): ArchivedWorkflowDraft | null {
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
