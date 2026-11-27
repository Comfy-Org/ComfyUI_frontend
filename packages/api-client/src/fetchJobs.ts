/**
 * @fileoverview Jobs API Fetchers
 * @module platform/remote/comfyui/jobs/fetchJobs
 *
 * Unified jobs API fetcher for history, queue, and job details.
 * All distributions use the /jobs endpoint.
 */

import type { ComfyWorkflowJSON } from '@comfyorg/graph-model/workflowSchema'
import { validateComfyWorkflow } from '@comfyorg/graph-model/workflowSchema'
import { reportError } from '@comfyorg/telemetry/reportError'
import type { JobId } from './executionTypes'

import type {
  JobAssetsResult,
  JobDetail,
  JobListItem,
  JobOutputAsset,
  JobStatus,
  RawJobListItem
} from './jobTypes'
import {
  zJobAssetsResponse,
  zJobDetail,
  zJobsListEnvelope,
  zRawJobListItem,
  zWorkflowContainer
} from './jobTypes'

interface ListedJob {
  job: RawJobListItem
  position: number
}

interface FetchJobsRawResult {
  jobs: ListedJob[]
  total: number
  offset: number
  limit: number
  hasMore: boolean
}

interface ContractIssue {
  code: string
  path: PropertyKey[]
}

interface OffContractJob {
  job: unknown
  issues: ContractIssue[]
}

class JobsApiError extends Error {}

const REPORT_SAMPLE_SIZE = 5
const reportedOffContractJobKeys = new Set<string>()

function jobIdOf(job: unknown): string | undefined {
  if (typeof job !== 'object' || job === null || !('id' in job)) return
  return typeof job.id === 'string' ? job.id : undefined
}

function reportOffContractJobs(offContract: OffContractJob[]): void {
  const keys = offContract.map(({ job }) => jobIdOf(job) ?? JSON.stringify(job))
  if (keys.every((key) => reportedOffContractJobKeys.has(key))) return
  keys.forEach((key) => reportedOffContractJobKeys.add(key))
  reportError(new Error('[Jobs API] Jobs outside the contract'), {
    errorType: 'jobs_list_job_outside_contract',
    surface: 'platform',
    level: 'warning',
    context: {
      count: offContract.length,
      samples: offContract
        .slice(0, REPORT_SAMPLE_SIZE)
        .map(({ job, issues }) => ({
          jobId: jobIdOf(job),
          issues: issues.slice(0, REPORT_SAMPLE_SIZE)
        }))
    }
  })
}

function parseJobsList(jobs: unknown[], strict: boolean): ListedJob[] {
  const parsed = jobs.map((job, position) => ({
    job,
    position,
    result: zRawJobListItem.safeParse(job)
  }))
  const offContract = parsed.flatMap(({ job, result }) =>
    result.success
      ? []
      : [
          {
            job,
            issues: result.error.issues.map(({ code, path }) => ({
              code,
              path
            }))
          }
        ]
  )
  if (offContract.length > 0) {
    reportOffContractJobs(offContract)
    if (strict) {
      throw new JobsApiError(`${offContract.length} jobs outside the contract`)
    }
  }
  return parsed.flatMap(({ position, result }) =>
    result.success ? [{ job: result.data, position }] : []
  )
}

interface FetchJobsOptions {
  throwOnError?: boolean
  cappedTotal?: boolean
}

export interface FetchHistoryPageResult {
  jobs: JobListItem[]
  total: number
  offset: number
  limit: number
  hasMore: boolean
}

/**
 * Fetches raw jobs from /jobs endpoint
 * @internal
 */
async function fetchJobsRaw(
  fetchApi: (url: string) => Promise<Response>,
  statuses: JobStatus[],
  maxItems: number = 200,
  offset: number = 0,
  options?: FetchJobsOptions
): Promise<FetchJobsRawResult> {
  const statusParam = statuses.join(',')
  const cappedTotalParam = options?.cappedTotal ? '&capped_total=true' : ''
  const url = `/jobs?status=${statusParam}&limit=${maxItems}&offset=${offset}${cappedTotalParam}`
  try {
    const res = await fetchApi(url)
    if (!res.ok) {
      throw new JobsApiError(`Failed to fetch jobs: ${res.status}`)
    }
    const data = zJobsListEnvelope.parse(await res.json())
    return {
      jobs: parseJobsList(data.jobs, !!options?.throwOnError),
      total: data.pagination.total,
      offset: data.pagination.offset,
      limit: data.pagination.limit,
      hasMore: data.pagination.has_more
    }
  } catch (error) {
    if (options?.throwOnError) throw error
    console.error('[Jobs API] Error fetching jobs:', error)
    return { jobs: [], total: 0, offset, limit: maxItems, hasMore: false }
  }
}

// Large offset to ensure running/pending jobs sort above history
const QUEUE_PRIORITY_BASE = 1_000_000

/**
 * Assigns synthetic priority to jobs.
 * Only assigns if job doesn't already have a server-provided priority.
 */
function assignPriority(
  jobs: ListedJob[],
  basePriority: number
): JobListItem[] {
  return jobs.map(({ job, position }) => ({
    ...job,
    priority: job.priority ?? basePriority - position
  }))
}

function inListOrder(jobs: RawJobListItem[]): ListedJob[] {
  return jobs.map((job, position) => ({ job, position }))
}

/**
 * Fetches history (terminal state jobs: completed, failed, cancelled)
 * Assigns synthetic priority starting from total (lower than queue jobs).
 */
export async function fetchHistory(
  fetchApi: (url: string) => Promise<Response>,
  maxItems: number = 200,
  offset: number = 0,
  options?: FetchJobsOptions
): Promise<JobListItem[]> {
  const { jobs } = await fetchHistoryPage(fetchApi, maxItems, offset, options)
  return jobs
}

/**
 * Fetches one page of history with server-provided pagination metadata.
 */
export async function fetchHistoryPage(
  fetchApi: (url: string) => Promise<Response>,
  maxItems: number = 200,
  offset: number = 0,
  options?: FetchJobsOptions
): Promise<FetchHistoryPageResult> {
  const result = await fetchJobsRaw(
    fetchApi,
    ['completed', 'failed', 'cancelled'],
    maxItems,
    offset,
    options
  )

  return {
    jobs: assignPriority(result.jobs, result.total - result.offset),
    total: result.total,
    offset: result.offset,
    limit: result.limit,
    hasMore: result.hasMore
  }
}

/**
 * Fetches queue (in_progress + pending jobs)
 * Pending jobs get highest priority, then running jobs.
 */
export async function fetchQueue(
  fetchApi: (url: string) => Promise<Response>,
  options?: FetchJobsOptions
): Promise<{ Running: JobListItem[]; Pending: JobListItem[] }> {
  const { jobs } = await fetchJobsRaw(
    fetchApi,
    ['in_progress', 'pending'],
    200,
    0,
    options
  )

  const running = jobs.flatMap(({ job }) =>
    job.status === 'in_progress' ? [job] : []
  )
  const pending = jobs.flatMap(({ job }) =>
    job.status === 'pending' ? [job] : []
  )

  return {
    Running: assignPriority(
      inListOrder(running),
      QUEUE_PRIORITY_BASE + running.length
    ),
    Pending: assignPriority(
      inListOrder(pending),
      QUEUE_PRIORITY_BASE + running.length + pending.length
    )
  }
}

/**
 * Fetches full job details from /jobs/{job_id}
 */
export async function fetchJobDetail(
  fetchApi: (url: string, init?: RequestInit) => Promise<Response>,
  jobId: JobId,
  signal?: AbortSignal
): Promise<JobDetail | undefined> {
  try {
    const res = await fetchApi(`/jobs/${encodeURIComponent(jobId)}`, {
      signal
    })

    if (!res.ok) {
      console.warn(`Job not found for job ${jobId}`)
      return undefined
    }

    return zJobDetail.parse(await res.json())
  } catch (error) {
    if (signal?.aborted) return undefined
    console.error(`Failed to fetch job detail for job ${jobId}:`, error)
    return undefined
  }
}

// Server caps the page size at 500; a single job's outputs fit well within a
// few pages, so this bound also guards against a runaway pagination loop.
const JOB_ASSETS_PAGE_SIZE = 500
const JOB_ASSETS_MAX_PAGES = 20

/**
 * Fetches all output assets for a job from GET /api/jobs/{job_id}/assets,
 * paginating internally. Each asset carries a real asset id plus per-output
 * node context (node_id, output_key, output_index) resolved server-side by
 * content hash. Degrades to whatever was accumulated on any failure (e.g. the
 * endpoint is unavailable on non-cloud distributions) so callers can still
 * render; `complete` is false whenever pages are known to be missing, so a
 * truncated list is distinguishable from a full one and callers can decline to
 * cache it.
 */
export async function fetchJobAssets(
  fetchApi: (url: string) => Promise<Response>,
  jobId: JobId
): Promise<JobAssetsResult> {
  const assets: JobOutputAsset[] = []
  let offset = 0

  try {
    for (let page = 0; page < JOB_ASSETS_MAX_PAGES; page++) {
      const url = `/jobs/${encodeURIComponent(jobId)}/assets?limit=${JOB_ASSETS_PAGE_SIZE}&offset=${offset}`
      const res = await fetchApi(url)
      if (!res.ok) {
        console.warn(
          `[Jobs API] Failed to fetch assets for job ${jobId}: ${res.status}`
        )
        return { assets, complete: false }
      }

      const data = zJobAssetsResponse.parse(await res.json())
      assets.push(...data.assets)

      const hasMore = data.pagination?.has_more ?? false
      if (!hasMore) return { assets, complete: true }

      if (data.assets.length === 0) {
        console.warn(
          `[Jobs API] Job ${jobId} assets page reported has_more with an empty page; stopping pagination`
        )
        return { assets, complete: false }
      }

      offset += data.assets.length
    }
  } catch (error) {
    console.error(`Failed to fetch assets for job ${jobId}:`, error)
    return { assets, complete: false }
  }

  console.warn(
    `[Jobs API] Job ${jobId} assets pagination hit the ${JOB_ASSETS_MAX_PAGES}-page cap; returning a truncated list`
  )
  return { assets, complete: false }
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

/**
 * Extracts the API-format graph a job stores at: workflow.prompt
 *
 * Jobs submitted through the API embed no editor workflow, leaving the
 * API-format prompt as the only graph they store. Returns undefined whenever
 * an embedded workflow exists so those submissions are always used as-is,
 * never re-derived. The prompt itself is returned unvalidated — callers gate
 * it with `app.isApiJson` before loading it.
 */
export function extractApiPrompt(job: JobDetail | undefined): unknown {
  const parsed = zWorkflowContainer.safeParse(job?.workflow)
  if (!parsed.success) return undefined

  const embeddedWorkflow = parsed.data.extra_data?.extra_pnginfo?.workflow
  if (embeddedWorkflow !== undefined && embeddedWorkflow !== null) {
    return undefined
  }

  return parsed.data.prompt
}
