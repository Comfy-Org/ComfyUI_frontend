/**
 * @fileoverview Job list reconciliation
 * @module platform/remote/comfyui/history/reconciliation
 *
 * Reconciles server jobs with client-cached jobs for efficient updates.
 * Uses job ID-based merging with create_time for sort order.
 */
import type { JobListItem } from '../jobs/jobTypes'

/**
 * Reconciles server jobs with client-cached jobs.
 * Uses job ID-based merging - jobs are identified by their unique ID,
 * and create_time determines sort order.
 *
 * @param serverJobs - Server's current job items (pre-sorted by API)
 * @param clientJobs - Client's cached job items
 * @param maxItems - Maximum number of items to return
 * @returns All items that should be displayed, sorted by create_time descending
 */
export function reconcileJobs(
  serverJobs: JobListItem[],
  clientJobs: JobListItem[],
  maxItems: number
): JobListItem[] {
  const serverIds = new Set(serverJobs.map((item) => item.id))
  const clientIds = new Set(clientJobs.map((item) => item.id))

  // Items from server not yet in client cache
  const newItems = serverJobs.filter((item) => !clientIds.has(item.id))

  // Retain client items that still exist on server
  const clientItemsStillOnServer = clientJobs.filter((item) =>
    serverIds.has(item.id)
  )

  // Merge and sort (needed because we're combining two sources)
  return [...newItems, ...clientItemsStillOnServer]
    .sort((a, b) => b.create_time - a.create_time)
    .slice(0, maxItems)
}
