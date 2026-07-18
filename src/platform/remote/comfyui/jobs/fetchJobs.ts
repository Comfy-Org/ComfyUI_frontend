/**
 * @fileoverview Jobs API Fetchers
 * @module platform/remote/comfyui/jobs/fetchJobs
 *
 * Unified jobs API fetcher for history, queue, and job details.
 * All distributions use the /jobs endpoint.
 */

import { z } from 'zod'

import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import { validateComfyWorkflow } from '@/platform/workflow/validation/schemas/workflowSchema'
import type { JobId } from '@/schemas/apiSchema'

import type {
  JobDetail,
  JobListItem,
  JobStatus,
  RawJobListItem
} from './jobTypes'
import { zJobDetail, zJobsListResponse, zWorkflowContainer } from './jobTypes'

/**
 * Position of the page to fetch. `after` is an opaque keyset cursor from a
 * prior response's `nextCursor` and takes precedence over `offset`; `offset`
 * remains as the fallback for random access and for backends that don't mint
 * cursors.
 */
export type JobsPageRequest =
  | { after: string; offset?: never }
  | { offset?: number; after?: never }

/**
 * Non-ok response from the jobs API. Carries the HTTP status and the parsed
 * machine-readable `errorCode` (from the JSON error body) so callers can tell a
 * rejected cursor (`INVALID_CURSOR`) apart from other 400s and transient
 * failures. `errorCode` is undefined when the body isn't the structured error
 * shape (e.g. a proxy error page).
 */
const MAX_ERROR_BODY_LENGTH = 200

const zJobsErrorBody = z.object({ code: z.string() })

function parseErrorCode(body: string): string | undefined {
  try {
    return zJobsErrorBody.safeParse(JSON.parse(body)).data?.code
  } catch {
    return undefined
  }
}

export class JobsApiError extends Error {
  readonly errorCode?: string

  constructor(
    readonly status: number,
    body: string
  ) {
    const truncated =
      body.length > MAX_ERROR_BODY_LENGTH
        ? `${body.slice(0, MAX_ERROR_BODY_LENGTH)}…`
        : body
    super(`[Jobs API] Failed to fetch jobs: ${status} ${truncated}`.trim())
    this.name = 'JobsApiError'
    this.errorCode = parseErrorCode(body)
  }
}

interface FetchJobsRawResult {
  jobs: RawJobListItem[]
  total: number
  offset: number
  limit: number
  hasMore: boolean
  nextCursor?: string
}

export interface FetchHistoryPageResult {
  jobs: JobListItem[]
  total: number
  offset: number
  limit: number
  hasMore: boolean
  nextCursor?: string
}

/**
 * Fetches raw jobs from /jobs endpoint.
 * Throws on failure so callers can tell a failed page apart from an empty
 * last page (e.g. a stale cursor rejected with 400 INVALID_CURSOR).
 * @internal
 */
async function fetchJobsRaw(
  fetchApi: (url: string) => Promise<Response>,
  statuses: JobStatus[],
  maxItems: number = 200,
  page: JobsPageRequest = {}
): Promise<FetchJobsRawResult> {
  const statusParam = statuses.join(',')
  const pageParam =
    page.after != null
      ? `after=${encodeURIComponent(page.after)}`
      : `offset=${page.offset ?? 0}`
  const url = `/jobs?status=${statusParam}&limit=${maxItems}&${pageParam}`
  const res = await fetchApi(url)
  if (!res.ok) {
    throw new JobsApiError(res.status, await res.text().catch(() => ''))
  }
  const data = zJobsListResponse.parse(await res.json())
  return {
    jobs: data.jobs,
    total: data.pagination.total,
    offset: data.pagination.offset,
    limit: data.pagination.limit,
    hasMore: data.pagination.has_more,
    nextCursor: data.pagination.next_cursor ?? undefined
  }
}

// Large offset to ensure running/pending jobs sort above history
const QUEUE_PRIORITY_BASE = 1_000_000

/**
 * Assigns synthetic priority to jobs.
 * Only assigns if job doesn't already have a server-provided priority.
 */
function assignPriority(
  jobs: RawJobListItem[],
  basePriority: number
): JobListItem[] {
  return jobs.map((job, index) => ({
    ...job,
    priority: job.priority ?? basePriority - index
  }))
}

/**
 * Fetches history (terminal state jobs: completed, failed, cancelled)
 * Assigns synthetic priority starting from total (lower than queue jobs).
 */
export async function fetchHistory(
  fetchApi: (url: string) => Promise<Response>,
  maxItems: number = 200,
  offset: number = 0
): Promise<JobListItem[]> {
  const { jobs } = await fetchHistoryPage(fetchApi, maxItems, { offset })
  return jobs
}

/**
 * Fetches one page of history with server-provided pagination metadata.
 */
export async function fetchHistoryPage(
  fetchApi: (url: string) => Promise<Response>,
  maxItems: number = 200,
  page: JobsPageRequest = {}
): Promise<FetchHistoryPageResult> {
  const result = await fetchJobsRaw(
    fetchApi,
    ['completed', 'failed', 'cancelled'],
    maxItems,
    page
  )

  // History gets priority based on total count (lower than queue)
  return {
    jobs: assignPriority(result.jobs, result.total - result.offset),
    total: result.total,
    offset: result.offset,
    limit: result.limit,
    hasMore: result.hasMore,
    nextCursor: result.nextCursor
  }
}

/**
 * Fetches queue (in_progress + pending jobs)
 * Pending jobs get highest priority, then running jobs.
 */
export async function fetchQueue(
  fetchApi: (url: string) => Promise<Response>
): Promise<{ Running: JobListItem[]; Pending: JobListItem[] }> {
  const { jobs } = await fetchJobsRaw(fetchApi, ['in_progress', 'pending'])

  const running = jobs.filter((j) => j.status === 'in_progress')
  const pending = jobs.filter((j) => j.status === 'pending')

  // Pending gets highest priority, then running
  // Both are above any history job due to QUEUE_PRIORITY_BASE
  return {
    Running: assignPriority(running, QUEUE_PRIORITY_BASE + running.length),
    Pending: assignPriority(
      pending,
      QUEUE_PRIORITY_BASE + running.length + pending.length
    )
  }
}

/**
 * Fetches full job details from /jobs/{job_id}
 */
export async function fetchJobDetail(
  fetchApi: (url: string) => Promise<Response>,
  jobId: JobId
): Promise<JobDetail | undefined> {
  try {
    const res = await fetchApi(`/jobs/${encodeURIComponent(jobId)}`)

    if (!res.ok) {
      console.warn(`Job not found for job ${jobId}`)
      return undefined
    }

    return zJobDetail.parse(await res.json())
  } catch (error) {
    console.error(`Failed to fetch job detail for job ${jobId}:`, error)
    return undefined
  }
}

/**
 * Extracts and validates workflow from job detail response.
 * The workflow is nested at: workflow.extra_data.extra_pnginfo.workflow
 *
 * Uses Zod validation via validateComfyWorkflow to ensure the workflow
 * conforms to the expected schema. Logs validation failures for debugging
 * but still returns undefined to allow graceful degradation.
 */
export async function extractWorkflow(
  job: JobDetail | undefined
): Promise<ComfyWorkflowJSON | undefined> {
  const parsed = zWorkflowContainer.safeParse(job?.workflow)
  if (!parsed.success) return undefined

  const rawWorkflow = parsed.data.extra_data?.extra_pnginfo?.workflow
  if (!rawWorkflow) return undefined

  const validated = await validateComfyWorkflow(rawWorkflow, (error) => {
    console.warn('[extractWorkflow] Workflow validation failed:', error)
  })

  return validated ?? undefined
}
