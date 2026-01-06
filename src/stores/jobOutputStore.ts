/**
 * @fileoverview Job output store for caching and managing job data
 * @module stores/jobOutputStore
 *
 * Centralizes job output and detail caching with LRU eviction.
 * Provides helpers for working with previewable outputs and workflows.
 */

import { defineStore } from 'pinia'

import type {
  JobDetail,
  JobListItem
} from '@/platform/remote/comfyui/jobs/jobTypes'
import {
  extractWorkflow,
  fetchJobDetail
} from '@/platform/remote/comfyui/jobs/fetchJobs'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import { ResultItemImpl } from '@/stores/queueStore'
import type { TaskItemImpl } from '@/stores/queueStore'

const MAX_TASK_CACHE_SIZE = 50
const MAX_JOB_DETAIL_CACHE_SIZE = 50

type FetchApi = (url: string) => Promise<Response>

function createLRUCache<T>(maxSize: number) {
  const cache = new Map<string, T>()

  return {
    get(key: string): T | undefined {
      return cache.get(key)
    },
    set(key: string, value: T) {
      if (cache.size >= maxSize) {
        const firstKey = cache.keys().next().value
        if (firstKey) cache.delete(firstKey)
      }
      cache.set(key, value)
    },
    clear() {
      cache.clear()
    },
    get size() {
      return cache.size
    }
  }
}

export const useJobOutputStore = defineStore('jobOutput', () => {
  const taskCache = createLRUCache<TaskItemImpl>(MAX_TASK_CACHE_SIZE)
  const jobDetailCache = createLRUCache<JobDetail>(MAX_JOB_DETAIL_CACHE_SIZE)

  // ===== Task Output Caching =====

  function getCachedTask(promptId: string): TaskItemImpl | undefined {
    return taskCache.get(promptId)
  }

  function getPreviewableOutputs(
    outputs: readonly ResultItemImpl[]
  ): ResultItemImpl[] {
    return ResultItemImpl.filterPreviewable(outputs)
  }

  function findActiveIndex(
    items: readonly ResultItemImpl[],
    url?: string
  ): number {
    return ResultItemImpl.findByUrl(items, url)
  }

  /**
   * Gets previewable outputs for a task, with lazy loading and caching
   */
  async function getOutputsForTask(
    task: TaskItemImpl
  ): Promise<ResultItemImpl[]> {
    const outputsCount = task.outputsCount ?? 0
    const needsLazyLoad = outputsCount > 1

    if (!needsLazyLoad) {
      return getPreviewableOutputs(task.flatOutputs)
    }

    const cacheKey = String(task.promptId)
    const cached = getCachedTask(cacheKey)
    if (cached) {
      return getPreviewableOutputs(cached.flatOutputs)
    }

    try {
      const loadedTask = await task.loadFullOutputs()
      taskCache.set(cacheKey, loadedTask)
      return getPreviewableOutputs(loadedTask.flatOutputs)
    } catch (error) {
      console.warn('Failed to load full outputs, using preview:', error)
      return getPreviewableOutputs(task.flatOutputs)
    }
  }

  // ===== Job Detail Caching =====

  function getCachedJobDetail(jobId: string): JobDetail | undefined {
    return jobDetailCache.get(jobId)
  }

  async function getJobDetail(
    fetchApi: FetchApi,
    jobId: string
  ): Promise<JobDetail | undefined> {
    const cached = getCachedJobDetail(jobId)
    if (cached) return cached

    try {
      const detail = await fetchJobDetail(fetchApi, jobId)
      if (detail) {
        jobDetailCache.set(jobId, detail)
      }
      return detail
    } catch (error) {
      console.warn('Failed to fetch job detail:', error)
      return undefined
    }
  }

  async function getJobWorkflow(
    fetchApi: FetchApi,
    jobId: string
  ): Promise<ComfyWorkflowJSON | undefined> {
    const detail = await getJobDetail(fetchApi, jobId)
    return extractWorkflow(detail)
  }

  async function getWorkflowForJob(
    fetchApi: FetchApi,
    job: JobListItem
  ): Promise<ComfyWorkflowJSON | undefined> {
    return getJobWorkflow(fetchApi, job.id)
  }

  // ===== Cache Management =====

  function clearTaskCache() {
    taskCache.clear()
  }

  function clearJobDetailCache() {
    jobDetailCache.clear()
  }

  function clearAllCaches() {
    taskCache.clear()
    jobDetailCache.clear()
  }

  return {
    // Task outputs
    getPreviewableOutputs,
    findActiveIndex,
    getOutputsForTask,
    getCachedTask,

    // Job details & workflows
    getJobDetail,
    getJobWorkflow,
    getWorkflowForJob,
    getCachedJobDetail,

    // Cache management
    clearTaskCache,
    clearJobDetailCache,
    clearAllCaches,
    // Deprecated - use clearTaskCache
    clearCache: clearTaskCache
  }
})
