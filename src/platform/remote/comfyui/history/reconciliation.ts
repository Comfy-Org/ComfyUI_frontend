/**
 * @fileoverview History reconciliation for V1 and V2 APIs
 * @module platform/remote/comfyui/history/reconciliation
 *
 * Returns which items to reuse vs create new, allowing callers to preserve
 * existing class instances for better performance.
 *
 * V1: QueueIndex-based filtering for stable monotonic indices
 * V2: PromptId-based merging for synthetic priorities (V2 assigns synthetic
 *     priorities after timestamp sorting, so new items may have lower priority
 *     than existing items)
 */

import type { TaskItem } from '@/schemas/apiSchema'

export interface ReconciliationResult {
  newItems: TaskItem[]
  reusePromptIds: Set<string>
}

/**
 * V1 reconciliation: QueueIndex-based filtering works because V1 has stable,
 * monotonically increasing queue indices.
 */
export function reconcileHistory(
  serverHistory: TaskItem[],
  clientHistory: { prompt: readonly [number, string, ...unknown[]] }[],
  lastKnownQueueIndex: number,
  maxItems: number
): ReconciliationResult {
  const serverPromptIds = new Set(serverHistory.map((item) => item.prompt[1]))

  const itemsAddedSinceLastSync = serverHistory.filter(
    (item) => item.prompt[0] > lastKnownQueueIndex
  )

  const clientPromptIdsStillOnServer = new Set<string>()
  for (const item of clientHistory) {
    const promptId = item.prompt[1]
    if (serverPromptIds.has(promptId)) {
      clientPromptIdsStillOnServer.add(promptId)
    }
  }

  const totalCount =
    itemsAddedSinceLastSync.length + clientPromptIdsStillOnServer.size

  if (totalCount > maxItems) {
    const allowedReuseCount = maxItems - itemsAddedSinceLastSync.length
    if (allowedReuseCount <= 0) {
      return {
        newItems: itemsAddedSinceLastSync.slice(0, maxItems),
        reusePromptIds: new Set()
      }
    }
    const trimmedReuseIds = new Set(
      Array.from(clientPromptIdsStillOnServer).slice(0, allowedReuseCount)
    )
    return {
      newItems: itemsAddedSinceLastSync,
      reusePromptIds: trimmedReuseIds
    }
  }

  return {
    newItems: itemsAddedSinceLastSync,
    reusePromptIds: clientPromptIdsStillOnServer
  }
}

/**
 * V2 reconciliation: PromptId-based merging because V2 assigns synthetic
 * priorities after sorting by timestamp.
 */
export function reconcileHistoryCloud(
  serverHistory: TaskItem[],
  clientHistory: { prompt: readonly [number, string, ...unknown[]] }[],
  maxItems: number
): ReconciliationResult {
  const serverPromptIds = new Set(serverHistory.map((item) => item.prompt[1]))
  const clientPromptIds = new Set(clientHistory.map((item) => item.prompt[1]))

  const newPromptIds = new Set(
    [...serverPromptIds].filter((id) => !clientPromptIds.has(id))
  )

  const newItems = serverHistory.filter((item) =>
    newPromptIds.has(item.prompt[1])
  )

  const clientPromptIdsStillOnServer = new Set<string>()
  for (const item of clientHistory) {
    const promptId = item.prompt[1]
    if (serverPromptIds.has(promptId)) {
      clientPromptIdsStillOnServer.add(promptId)
    }
  }

  const totalCount = newItems.length + clientPromptIdsStillOnServer.size

  if (totalCount > maxItems) {
    const allowedReuseCount = maxItems - newItems.length
    if (allowedReuseCount <= 0) {
      return {
        newItems: newItems.slice(0, maxItems),
        reusePromptIds: new Set()
      }
    }
    const trimmedReuseIds = new Set(
      Array.from(clientPromptIdsStillOnServer).slice(0, allowedReuseCount)
    )
    return {
      newItems,
      reusePromptIds: trimmedReuseIds
    }
  }

  return {
    newItems,
    reusePromptIds: clientPromptIdsStillOnServer
  }
}
