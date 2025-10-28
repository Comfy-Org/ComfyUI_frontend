/**
 * @fileoverview History reconciliation for V1 and V2 APIs
 * @module platform/remote/comfyui/history/reconciliation
 *
 * Returns which items to reuse vs create new, allowing callers to preserve
 * existing class instances for better performance. Results are pre-sorted by
 * queueIndex (newest first) to avoid sorting overhead in caller.
 *
 * V1: QueueIndex-based filtering for stable monotonic indices
 * V2: PromptId-based merging for synthetic priorities (V2 assigns synthetic
 *     priorities after timestamp sorting, so new items may have lower priority
 *     than existing items)
 */
import type { PromptId, TaskItem, TaskPrompt } from '@/schemas/apiSchema'

interface ReconciliationResult {
  /** New items from server, sorted by queueIndex descending (newest first) */
  newItems: TaskItem[]
  /** PromptIds to reuse from client, in sorted order by queueIndex descending */
  reusePromptIds: PromptId[]
}

/**
 * V1 reconciliation: QueueIndex-based filtering works because V1 has stable,
 * monotonically increasing queue indices.
 *
 * Sort order: Sorts serverHistory by queueIndex descending (newest first) to ensure
 * consistent ordering. JavaScript .filter() maintains iteration order, so filtered
 * results remain sorted. clientHistory is assumed already sorted from previous update.
 */
export function reconcileHistory(
  serverHistory: TaskItem[],
  clientHistory: { prompt: TaskPrompt }[],
  lastKnownQueueIndex: number,
  maxItems: number
): ReconciliationResult {
  const sortedServerHistory = serverHistory.sort(
    (a, b) => b.prompt[0] - a.prompt[0]
  )

  const serverPromptIds = new Set(
    sortedServerHistory.map((item) => item.prompt[1])
  )

  const itemsAddedSinceLastSync = sortedServerHistory.filter(
    (item) => item.prompt[0] > lastKnownQueueIndex
  )

  const clientItemsStillOnServer = clientHistory.filter((item) =>
    serverPromptIds.has(item.prompt[1])
  )

  const totalCount =
    itemsAddedSinceLastSync.length + clientItemsStillOnServer.length

  if (totalCount > maxItems) {
    const allowedReuseCount = maxItems - itemsAddedSinceLastSync.length
    if (allowedReuseCount <= 0) {
      return {
        newItems: itemsAddedSinceLastSync.slice(0, maxItems),
        reusePromptIds: []
      }
    }
    return {
      newItems: itemsAddedSinceLastSync,
      reusePromptIds: clientItemsStillOnServer
        .slice(0, allowedReuseCount)
        .map((item) => item.prompt[1])
    }
  }

  return {
    newItems: itemsAddedSinceLastSync,
    reusePromptIds: clientItemsStillOnServer.map((item) => item.prompt[1])
  }
}

/**
 * V2 reconciliation: PromptId-based merging because V2 assigns synthetic
 * priorities after sorting by timestamp.
 *
 * Sort order: Sorts serverHistory by queueIndex descending (newest first) to ensure
 * consistent ordering. JavaScript .filter() maintains iteration order, so filtered
 * results remain sorted. clientHistory is assumed already sorted from previous update.
 */
export function reconcileHistoryCloud(
  serverHistory: TaskItem[],
  clientHistory: { prompt: TaskPrompt }[],
  maxItems: number
): ReconciliationResult {
  const sortedServerHistory = serverHistory.sort(
    (a, b) => b.prompt[0] - a.prompt[0]
  )

  const serverPromptIds = new Set(
    sortedServerHistory.map((item) => item.prompt[1])
  )
  const clientPromptIds = new Set(clientHistory.map((item) => item.prompt[1]))

  const newPromptIds = new Set(
    [...serverPromptIds].filter((id) => !clientPromptIds.has(id))
  )

  const newItems = sortedServerHistory.filter((item) =>
    newPromptIds.has(item.prompt[1])
  )

  const clientItemsStillOnServer = clientHistory.filter((item) =>
    serverPromptIds.has(item.prompt[1])
  )

  const totalCount = newItems.length + clientItemsStillOnServer.length

  if (totalCount > maxItems) {
    const allowedReuseCount = maxItems - newItems.length
    if (allowedReuseCount <= 0) {
      return {
        newItems: newItems.slice(0, maxItems),
        reusePromptIds: []
      }
    }
    return {
      newItems,
      reusePromptIds: clientItemsStillOnServer
        .slice(0, allowedReuseCount)
        .map((item) => item.prompt[1])
    }
  }

  return {
    newItems,
    reusePromptIds: clientItemsStillOnServer.map((item) => item.prompt[1])
  }
}
