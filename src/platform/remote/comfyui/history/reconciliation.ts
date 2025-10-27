/**
 * @fileoverview History reconciliation for V1 and V2 APIs
 * @module platform/remote/comfyui/history/reconciliation
 *
 * V1: QueueIndex-based filtering for stable monotonic indices
 * V2: PromptId-based merging for synthetic priorities
 */

import type { TaskItem } from '@/schemas/apiSchema'

/**
 * V1 reconciliation: QueueIndex-based filtering.
 *
 * Why queueIndex filtering works for V1:
 * - V1 has stable, monotonically increasing queue indices
 * - queueIndex > lastKnownQueueIndex reliably detects new items
 * - Efficient incremental updates without full replacement
 */
export function reconcileHistory(
  serverHistory: TaskItem[],
  clientHistory: TaskItem[],
  lastKnownQueueIndex: number,
  maxItems: number
): TaskItem[] {
  const serverPromptIds = new Set(serverHistory.map((item) => item.prompt[1]))

  const itemsAddedSinceLastSync = serverHistory.filter(
    (item) => item.prompt[0] > lastKnownQueueIndex
  )

  const itemsStillOnServer = clientHistory.filter((item) =>
    serverPromptIds.has(item.prompt[1])
  )

  return [...itemsAddedSinceLastSync, ...itemsStillOnServer].slice(0, maxItems)
}

/**
 * V2 reconciliation: PromptId-based merging to handle synthetic priorities.
 *
 * Why not use queueIndex filtering:
 * - V2 creates synthetic priorities after sorting by timestamp
 * - New items may have lower synthetic priority than existing items
 * - Must use promptId to identify truly new items
 */
export function reconcileHistoryCloud(
  serverHistory: TaskItem[],
  clientHistory: TaskItem[],
  maxItems: number
): TaskItem[] {
  const serverPromptIds = new Set(serverHistory.map((item) => item.prompt[1]))
  const clientPromptIds = new Set(clientHistory.map((item) => item.prompt[1]))

  const newPromptIds = new Set(
    [...serverPromptIds].filter((id) => !clientPromptIds.has(id))
  )

  const newItems = serverHistory.filter((item) =>
    newPromptIds.has(item.prompt[1])
  )

  const existingItems = clientHistory.filter((item) =>
    serverPromptIds.has(item.prompt[1])
  )

  return [...newItems, ...existingItems].slice(0, maxItems)
}
