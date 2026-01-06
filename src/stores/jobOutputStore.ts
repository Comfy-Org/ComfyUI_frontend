/**
 * @fileoverview Job output store for caching and managing job data
 * @module stores/jobOutputStore
 *
 * Centralizes job output and detail caching with LRU eviction.
 * Provides helpers for working with previewable outputs and workflows.
 */

import { defineStore } from 'pinia'

import type { JobDetail } from '@/platform/remote/comfyui/jobs/jobTypes'
import {
  extractWorkflow,
  fetchJobDetail
} from '@/platform/remote/comfyui/jobs/fetchJobs'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import { api } from '@/scripts/api'
import { ResultItemImpl } from '@/stores/queueStore'
import type { TaskItemImpl } from '@/stores/queueStore'

const MAX_TASK_CACHE_SIZE = 50
const MAX_JOB_DETAIL_CACHE_SIZE = 50

function createLRUCache<T>(maxSize: number) {
  const cache = new Map<string, T>()

  return {
    get(key: string): T | undefined {
      const value = cache.get(key)
      if (value !== undefined) {
        // Move to end (most recently used)
        cache.delete(key)
        cache.set(key, value)
      }
      return value
    },
    set(key: string, value: T) {
      // Delete first to ensure key moves to end even if it exists
      cache.delete(key)
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

  // Track latest request to dedupe stale responses
  let latestTaskRequestId: string | null = null

  // ===== Task Output Caching =====

  function findActiveIndex(
    items: readonly ResultItemImpl[],
    url?: string
  ): number {
    return ResultItemImpl.findByUrl(items, url)
  }

  /**
   * Gets previewable outputs for a task, with lazy loading, caching, and request deduping.
   * Returns null if a newer request superseded this one while loading.
   */
  async function getOutputsForTask(
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

  // ===== Job Detail Caching =====

  async function getJobDetail(jobId: string): Promise<JobDetail | undefined> {
    const cached = jobDetailCache.get(jobId)
    if (cached) return cached

    try {
      const detail = await fetchJobDetail((url) => api.fetchApi(url), jobId)
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
    jobId: string
  ): Promise<ComfyWorkflowJSON | undefined> {
    const detail = await getJobDetail(jobId)
    return extractWorkflow(detail)
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
    findActiveIndex,
    getOutputsForTask,

    // Job details & workflows
    getJobDetail,
    getJobWorkflow,

    // Cache management
    clearTaskCache,
    clearJobDetailCache,
    clearAllCaches
  }
})
