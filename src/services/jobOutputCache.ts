/**
 * @fileoverview Job output cache for caching and managing job data
 * @module services/jobOutputCache
 *
 * Centralizes job output and detail caching with LRU eviction.
 * Provides helpers for working with previewable outputs and workflows.
 */

import QuickLRU from '@alloc/quick-lru'

import type { JobDetail } from '@/platform/remote/comfyui/jobs/jobTypes'
import { extractWorkflow } from '@/platform/remote/comfyui/jobs/fetchJobs'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import type { ResultItem, TaskOutput } from '@/schemas/apiSchema'
import { api } from '@/scripts/api'
import { ResultItemImpl } from '@/stores/queueStore'
import type { TaskItemImpl } from '@/stores/queueStore'

const MAX_TASK_CACHE_SIZE = 50
const MAX_JOB_DETAIL_CACHE_SIZE = 50

const taskCache = new QuickLRU<string, TaskItemImpl>({
  maxSize: MAX_TASK_CACHE_SIZE
})
const jobDetailCache = new QuickLRU<string, JobDetail>({
  maxSize: MAX_JOB_DETAIL_CACHE_SIZE
})

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
  const requestId = String(task.promptId)
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
  const resultItems = Object.entries(outputs).flatMap(([nodeId, nodeOutputs]) =>
    Object.entries(nodeOutputs)
      .filter(([mediaType, items]) => mediaType !== 'animated' && items)
      .flatMap(([mediaType, items]) => {
        if (!Array.isArray(items)) {
          return []
        }

        return (items as ResultItem[])
          .filter((item) => typeof item === 'object' && item !== null)
          .map(
            (item) =>
              new ResultItemImpl({
                ...item,
                nodeId,
                mediaType
              })
          )
      })
  )

  return ResultItemImpl.filterPreviewable(resultItems)
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

export async function getJobWorkflow(
  jobId: string
): Promise<ComfyWorkflowJSON | undefined> {
  const detail = await getJobDetail(jobId)
  return await extractWorkflow(detail)
}
