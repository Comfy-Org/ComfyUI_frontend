/**
 * @fileoverview Job list reconciliation
 * @module platform/remote/comfyui/history/reconciliation
 *
 * Reconciles server jobs with client-cached jobs for efficient updates.
 * Uses job ID-based merging with create_time for sort order.
 */
import type { JobListItem } from '../jobs/jobTypes'

/**
 * Reconciles server jobs for history display.
 * Server is the source of truth.
 *
 * @param serverJobs - Server's current job items (pre-sorted by API)
 * @param maxItems - Maximum number of items to return
 * @returns Server items sorted by create_time descending, limited to maxItems
 */
export function reconcileJobs(
  serverJobs: JobListItem[],
  maxItems: number
): JobListItem[] {
  // Server is source of truth - use server data directly
  // Items not on server are considered stale and evicted
  return [...serverJobs]
    .sort((a, b) => b.create_time - a.create_time)
    .slice(0, maxItems)
}
