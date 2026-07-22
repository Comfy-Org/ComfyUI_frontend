/**
 * @fileoverview Job output cache for caching and managing job data
 * @module services/jobOutputCache
 *
 * Centralizes job output and detail caching with LRU eviction.
 * Provides helpers for working with previewable outputs and workflows.
 */

import QuickLRU from '@alloc/quick-lru'

import type { JobDetail } from '@/platform/remote/comfyui/jobs/jobTypes'
import {
  extractApiPrompt,
  extractWorkflow
} from '@/platform/remote/comfyui/jobs/fetchJobs'
import { convertApiGraphToWorkflow } from '@/platform/workflow/utils/apiGraphConversionUtil'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import type { TaskOutput } from '@/schemas/apiSchema'
import { api } from '@/scripts/api'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { ResultItemImpl } from '@/stores/queueStore'
import type { TaskItemImpl } from '@/stores/queueStore'
import { parseTaskOutput } from '@/stores/resultItemParsing'

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

export async function getJobWorkflow(
  jobId: string
): Promise<ComfyWorkflowJSON | undefined> {
  const detail = await getJobDetail(jobId)
  return (
    (await extractWorkflow(detail)) ??
    (await synthesizeWorkflowFromApiPrompt(detail))
  )
}

/**
 * Fallback for API/MCP-submitted jobs, which embed no UI workflow: synthesize
 * one from the stored API-format graph. The synthesized graph is only handed
 * to the caller — it is never written back to the job or its assets;
 * persistence happens when the user saves the opened workflow.
 */
async function synthesizeWorkflowFromApiPrompt(
  detail: JobDetail | undefined
): Promise<ComfyWorkflowJSON | undefined> {
  const apiPrompt = extractApiPrompt(detail)
  if (!apiPrompt) return undefined

  try {
    const { nodeDefsByName } = useNodeDefStore()
    return (
      (await convertApiGraphToWorkflow(apiPrompt, nodeDefsByName)) ?? undefined
    )
  } catch (error) {
    console.warn('Failed to synthesize workflow from API prompt:', error)
    return undefined
  }
}
