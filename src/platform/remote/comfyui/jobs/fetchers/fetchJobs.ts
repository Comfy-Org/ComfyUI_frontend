/**
 * @fileoverview Jobs API Fetchers
 * @module platform/remote/comfyui/jobs/fetchers/fetchJobs
 *
 * Unified jobs API fetcher for history, queue, and job details.
 * All distributions use the /jobs endpoint.
 */

import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import type { PromptId } from '@/schemas/apiSchema'

import type {
  JobDetail,
  JobListItem,
  JobStatus,
  RawJobListItem
} from '../types/jobTypes'
import { zJobDetail, zJobsListResponse } from '../types/jobTypes'

// ============================================================================
// Job List Fetchers
// ============================================================================

interface FetchJobsRawResult {
  jobs: RawJobListItem[]
  total: number
  offset: number
}

/**
 * Fetches raw jobs from /jobs endpoint
 * @internal
 */
async function fetchJobsRaw(
  fetchApi: (url: string) => Promise<Response>,
  statuses: JobStatus[],
  maxItems: number = 200,
  offset: number = 0
): Promise<FetchJobsRawResult> {
  const statusParam = statuses.join(',')
  const url = `/jobs?status=${statusParam}&limit=${maxItems}&offset=${offset}&sort_by=create_time&order=desc`
  try {
    const res = await fetchApi(url)
    if (!res.ok) {
      console.error(`[Jobs API] Failed to fetch jobs: ${res.status}`)
      return { jobs: [], total: 0, offset: 0 }
    }
    const data = zJobsListResponse.parse(await res.json())
    return { jobs: data.jobs, total: data.total, offset }
  } catch (error) {
    console.error('[Jobs API] Error fetching jobs:', error)
    return { jobs: [], total: 0, offset: 0 }
  }
}

/**
 * Assigns synthetic priority to jobs based on sorted position.
 * Priority = total - offset - index (highest = newest)
 * Only assigns if job doesn't already have a server-provided priority.
 */
function assignSyntheticPriority(
  jobs: RawJobListItem[],
  total: number,
  offset: number
): JobListItem[] {
  return jobs.map((job, index) => ({
    ...job,
    priority: job.priority ?? total - offset - index
  }))
}

/**
 * Fetches history (completed jobs)
 * Returns jobs sorted by create_time descending (newest first) via API
 * Assigns synthetic priority based on position if not provided by server.
 */
export async function fetchHistory(
  fetchApi: (url: string) => Promise<Response>,
  maxItems: number = 200,
  offset: number = 0
): Promise<JobListItem[]> {
  const {
    jobs,
    total,
    offset: responseOffset
  } = await fetchJobsRaw(fetchApi, ['completed'], maxItems, offset)
  return assignSyntheticPriority(jobs, total, responseOffset)
}

/**
 * Fetches queue (in_progress + pending jobs)
 * Assigns synthetic priority based on position if not provided by server.
 */
export async function fetchQueue(
  fetchApi: (url: string) => Promise<Response>
): Promise<{ Running: JobListItem[]; Pending: JobListItem[] }> {
  const { jobs, total, offset } = await fetchJobsRaw(
    fetchApi,
    ['in_progress', 'pending'],
    200,
    0
  )
  const jobsWithPriority = assignSyntheticPriority(jobs, total, offset)

  return {
    Running: jobsWithPriority.filter((j) => j.status === 'in_progress'),
    Pending: jobsWithPriority.filter((j) => j.status === 'pending')
  }
}

// ============================================================================
// Job Detail Fetcher
// ============================================================================

/**
 * Fetches full job details from /jobs/{job_id}
 */
export async function fetchJobDetail(
  fetchApi: (url: string) => Promise<Response>,
  promptId: PromptId
): Promise<JobDetail | undefined> {
  try {
    const res = await fetchApi(`/jobs/${promptId}`)

    if (!res.ok) {
      console.warn(`Job not found for prompt ${promptId}`)
      return undefined
    }

    return zJobDetail.parse(await res.json())
  } catch (error) {
    console.error(`Failed to fetch job detail for prompt ${promptId}:`, error)
    return undefined
  }
}

/**
 * Extracts workflow from job detail response
 */
export function extractWorkflow(
  job: JobDetail | undefined
): ComfyWorkflowJSON | undefined {
  // Cast is safe - workflow will be validated by loadGraphData -> validateComfyWorkflow
  // Path: extra_data.extra_pnginfo.workflow (at top level of job detail)
  return job?.extra_data?.extra_pnginfo?.workflow as
    | ComfyWorkflowJSON
    | undefined
}
