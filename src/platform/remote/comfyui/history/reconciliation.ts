/**
 * @fileoverview History reconciliation for V1 and V2 APIs
 * @module platform/remote/comfyui/history/reconciliation
 *
 * Returns list of items that should be displayed, sorted by queueIndex (newest first).
 * Caller is responsible for mapping to their own class instances.
 *
 * V1: QueueIndex-based filtering for stable monotonic indices
 * V2: PromptId-based merging for synthetic priorities (V2 assigns synthetic
 *     priorities after timestamp sorting, so new items may have lower priority
 *     than existing items)
 */
import { isCloud } from '@/platform/distribution/types'
import type { TaskItem } from '@/schemas/apiSchema'

interface ReconciliationResult {
  /** All items to display, sorted by queueIndex descending (newest first) */
  items: TaskItem[]
}

/**
 * V1 reconciliation: QueueIndex-based filtering works because V1 has stable,
 * monotonically increasing queue indices.
 *
 * Sort order: Sorts serverHistory by queueIndex descending (newest first) to ensure
 * consistent ordering. JavaScript .filter() maintains iteration order, so filtered
 * results remain sorted. clientHistory is assumed already sorted from previous update.
 */
function reconcileHistoryV1(
  serverHistory: TaskItem[],
  clientHistory: TaskItem[],
  maxItems: number,
  lastKnownQueueIndex: number | undefined
): ReconciliationResult {
  const sortedServerHistory = serverHistory.sort(
    (a, b) => b.prompt[0] - a.prompt[0]
  )

  const serverPromptIds = new Set(
    sortedServerHistory.map((item) => item.prompt[1])
  )

  // If undefined, treat as initial sync (all items are new)
  const itemsAddedSinceLastSync =
    lastKnownQueueIndex === undefined
      ? sortedServerHistory
      : sortedServerHistory.filter(
          (item) => item.prompt[0] > lastKnownQueueIndex
        )

  const clientItemsStillOnServer = clientHistory.filter((item) =>
    serverPromptIds.has(item.prompt[1])
  )

  // Merge new and reused items, sort by queueIndex descending, limit to maxItems
  const allItems = [...itemsAddedSinceLastSync, ...clientItemsStillOnServer]
    .sort((a, b) => b.prompt[0] - a.prompt[0])
    .slice(0, maxItems)

  return {
    items: allItems
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
function reconcileHistoryV2(
  serverHistory: TaskItem[],
  clientHistory: TaskItem[],
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

  const retainedPromptIds = new Set(
    [...serverPromptIds].filter((id) => clientPromptIds.has(id))
  )
  const clientItemsStillOnServer = clientHistory.filter((item) =>
    retainedPromptIds.has(item.prompt[1])
  )

  // Merge new and reused items, sort by queueIndex descending, limit to maxItems
  const allItems = [...newItems, ...clientItemsStillOnServer]
    .sort((a, b) => b.prompt[0] - a.prompt[0])
    .slice(0, maxItems)

  return {
    items: allItems
  }
}

/**
 * Reconciles server history with client history.
 * Automatically uses V1 (queueIndex-based) or V2 (promptId-based) algorithm based on
 * distribution type.
 *
 * @param serverHistory - Server's current history items
 * @param clientHistory - Client's existing history items
 * @param maxItems - Maximum number of items to return
 * @param lastKnownQueueIndex - Last queue index seen (V1 only, optional for V2)
 * @returns All items that should be displayed, sorted by queueIndex descending
 */
export function reconcileHistory(
  serverHistory: TaskItem[],
  clientHistory: TaskItem[],
  maxItems: number,
  lastKnownQueueIndex?: number
): ReconciliationResult {
  if (isCloud) {
    return reconcileHistoryV2(serverHistory, clientHistory, maxItems)
  }
  return reconcileHistoryV1(
    serverHistory,
    clientHistory,
    maxItems,
    lastKnownQueueIndex
  )
}
