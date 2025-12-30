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
 * Server is the source of truth - always prefer server data for all fields.
 * Client items not present on server are evicted.
 *
 * @param serverJobs - Server's current job items (pre-sorted by API)
 * @param _clientJobs - Client's cached job items (unused, kept for API compatibility)
 * @param maxItems - Maximum number of items to return
 * @returns Server items sorted by create_time descending, limited to maxItems
 */
export function reconcileJobs(
  serverJobs: JobListItem[],
  _clientJobs: JobListItem[],
  maxItems: number
): JobListItem[] {
  // Server is source of truth - use server data directly
  // Items not on server are considered stale and evicted
  return [...serverJobs]
    .sort((a, b) => b.create_time - a.create_time)
    .slice(0, maxItems)
}
