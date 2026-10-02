import type { WorkflowListResponse } from '@comfyorg/ingest-types'
import { zWorkflowListResponse } from '@comfyorg/ingest-types/zod'

const CLOUD_WORKFLOW_PAGE_SIZE = 100

/** One page of the workspace's Cloud workflow library, as the API defines it. */
export const zCloudWorkflowPage = zWorkflowListResponse
export type CloudWorkflowPage = WorkflowListResponse
export type CloudWorkflowEntry = CloudWorkflowPage['data'][number]
/** The part of an entry a caller that matches by name reads. */
export type CloudWorkflowRef = Pick<CloudWorkflowEntry, 'id' | 'name'>

export function cloudWorkflowPageRoute({
  name,
  after
}: { name?: string; after?: string } = {}): string {
  const byName = name === undefined ? '' : `name=${encodeURIComponent(name)}&`
  const next = after ? `&after=${encodeURIComponent(after)}` : ''
  return `/workflows?${byName}limit=${CLOUD_WORKFLOW_PAGE_SIZE}${next}`
}

/**
 * Where a walk goes after this page. `broken` is a page that says more exist
 * but gives no cursor, or a cursor the walk has already followed: the rest
 * of the library cannot be reached, and each caller decides what that means.
 */
export type NextCloudWorkflowPage =
  | { kind: 'done' }
  | { kind: 'next'; cursor: string }
  | { kind: 'broken' }

export function nextCloudWorkflowPage(
  page: CloudWorkflowPage,
  seen: Set<string>
): NextCloudWorkflowPage {
  if (!page.pagination.has_more) return { kind: 'done' }
  const cursor = page.pagination.next_cursor
  if (!cursor || seen.has(cursor)) return { kind: 'broken' }
  seen.add(cursor)
  return { kind: 'next', cursor }
}
