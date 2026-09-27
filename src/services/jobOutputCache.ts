/**
 * @fileoverview Job output cache for caching and managing job data
 * @module services/jobOutputCache
 *
 * Centralizes job output and detail caching with LRU eviction.
 * Provides helpers for working with previewable outputs and workflows.
 */

import QuickLRU from '@alloc/quick-lru'

import type {
  JobDetail,
  JobOutputAsset
} from '@/platform/remote/comfyui/jobs/jobTypes'
import { extractWorkflow } from '@/platform/remote/comfyui/jobs/fetchJobs'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import type { TaskOutput } from '@/schemas/apiSchema'
import { api } from '@/scripts/api'
import { ResultItemImpl } from '@/stores/queueStore'
import type { TaskItemImpl } from '@/stores/queueStore'
import { parseTaskOutput } from '@/stores/resultItemParsing'

const MAX_TASK_CACHE_SIZE = 50
const MAX_JOB_DETAIL_CACHE_SIZE = 50
const MAX_JOB_ASSETS_CACHE_SIZE = 50

const taskCache = new QuickLRU<string, TaskItemImpl>({
  maxSize: MAX_TASK_CACHE_SIZE
})
const jobDetailCache = new QuickLRU<string, JobDetail>({
  maxSize: MAX_JOB_DETAIL_CACHE_SIZE
})
const jobAssetsCache = new QuickLRU<string, JobOutputAsset[]>({
  maxSize: MAX_JOB_ASSETS_CACHE_SIZE
})
const inFlightJobAssets = new Map<string, Promise<JobOutputAsset[]>>()

// Track latest request to dedupe stale responses
let latestTaskRequestId: string | null = null

// ===== Task Output Caching =====

export function findActiveIndex(
  items: readonly ResultItemImpl[],
  url?: string
): number {
  return ResultItemImpl.findByUrl(items, url)
}

/**
 * Gets previewable outputs for a task, with lazy loading, caching, and request deduping.
 * Returns null if a newer request superseded this one while loading.
 */
export async function getOutputsForTask(
  task: TaskItemImpl
): Promise<ResultItemImpl[] | null> {
  const requestId = String(task.jobId)
  latestTaskRequestId = requestId

  const outputsCount = task.outputsCount ?? 0
  const needsLazyLoad = outputsCount > 1

  if (!needsLazyLoad) {
    return [...task.previewableOutputs]
  }

  const cached = taskCache.get(requestId)
  if (cached) {
    return [...cached.previewableOutputs]
  }

  try {
    const loadedTask = await task.loadFullOutputs()

    // Check if request was superseded while loading
    if (latestTaskRequestId !== requestId) {
      return null
    }

    taskCache.set(requestId, loadedTask)
    return [...loadedTask.previewableOutputs]
  } catch (error) {
    console.warn('Failed to load full outputs, using preview:', error)
    return [...task.previewableOutputs]
  }
}

function getPreviewableOutputs(outputs?: TaskOutput): ResultItemImpl[] {
  if (!outputs) return []
  return ResultItemImpl.filterPreviewable(parseTaskOutput(outputs))
}

export function getPreviewableOutputsFromJobDetail(
  jobDetail?: JobDetail
): ResultItemImpl[] {
  return getPreviewableOutputs(jobDetail?.outputs)
}

// ===== Job Detail Caching =====

export async function getJobDetail(
  jobId: string
): Promise<JobDetail | undefined> {
  const cached = jobDetailCache.get(jobId)
  if (cached) return cached

  try {
    const detail = await api.getJobDetail(jobId)
    if (detail) {
      jobDetailCache.set(jobId, detail)
    }
    return detail
  } catch (error) {
    console.warn('Failed to fetch job detail:', error)
    return undefined
  }
}

/**
 * Gets a job's output assets with LRU caching and in-flight request dedupe,
 * so N concurrent resolutions of the same job issue one network request.
 * Only complete, non-empty results are cached: an empty list usually means the
 * endpoint is unavailable or the assets are not yet persisted, and a truncated
 * one means a page failed mid-pagination. Caching either would pin an
 * under-resolved set until LRU eviction, long after the endpoint recovered.
 */
export async function getJobAssets(jobId: string): Promise<JobOutputAsset[]> {
  const cached = jobAssetsCache.get(jobId)
  if (cached) return cached

  const inFlight = inFlightJobAssets.get(jobId)
  if (inFlight) return inFlight

  const request = api
    .getJobAssets(jobId)
    .then(({ assets, complete }) => {
      if (complete && assets.length) jobAssetsCache.set(jobId, assets)
      return assets
    })
    .finally(() => inFlightJobAssets.delete(jobId))
  inFlightJobAssets.set(jobId, request)
  return request
}

export async function getJobWorkflow(
  jobId: string
): Promise<ComfyWorkflowJSON | undefined> {
  const detail = await getJobDetail(jobId)
  return await extractWorkflow(detail)
}
