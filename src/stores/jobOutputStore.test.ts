import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  JobDetail,
  JobListItem
} from '@/platform/remote/comfyui/jobs/jobTypes'
import { useJobOutputStore } from '@/stores/jobOutputStore'
import { ResultItemImpl, TaskItemImpl } from '@/stores/queueStore'

vi.mock('@/platform/remote/comfyui/jobs/fetchJobs', () => ({
  fetchJobDetail: vi.fn(),
  extractWorkflow: vi.fn()
}))

function createResultItem(url: string, supportsPreview = true): ResultItemImpl {
  const item = new ResultItemImpl({
    filename: url,
    subfolder: '',
    type: 'output',
    nodeId: 'node-1',
    mediaType: supportsPreview ? 'images' : 'unknown'
  })
  Object.defineProperty(item, 'url', { get: () => url })
  Object.defineProperty(item, 'supportsPreview', { get: () => supportsPreview })
  return item
}

function createMockJob(id: string, outputsCount = 1): JobListItem {
  return {
    id,
    status: 'completed',
    create_time: Date.now(),
    preview_output: null,
    outputs_count: outputsCount,
    priority: 0
  }
}

function createTask(
  preview?: ResultItemImpl,
  allOutputs?: ResultItemImpl[],
  outputsCount = 1
): TaskItemImpl {
  const job = createMockJob(
    `task-${Math.random().toString(36).slice(2)}`,
    outputsCount
  )
  const flatOutputs = allOutputs ?? (preview ? [preview] : [])
  return new TaskItemImpl(job, {}, flatOutputs)
}

describe('jobOutputStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
  })

  describe('getPreviewableOutputs', () => {
    it('filters to only previewable outputs', () => {
      const store = useJobOutputStore()
      const previewable = createResultItem('p-1', true)
      const nonPreviewable = createResultItem('p-2', false)

      const result = store.getPreviewableOutputs([previewable, nonPreviewable])

      expect(result).toEqual([previewable])
    })

    it('returns empty array when no outputs support preview', () => {
      const store = useJobOutputStore()
      const nonPreviewable = createResultItem('p-1', false)

      const result = store.getPreviewableOutputs([nonPreviewable])

      expect(result).toEqual([])
    })
  })

  describe('findActiveIndex', () => {
    it('returns index of matching URL', () => {
      const store = useJobOutputStore()
      const items = [
        createResultItem('a'),
        createResultItem('b'),
        createResultItem('c')
      ]

      expect(store.findActiveIndex(items, 'b')).toBe(1)
    })

    it('returns 0 when URL not found', () => {
      const store = useJobOutputStore()
      const items = [createResultItem('a'), createResultItem('b')]

      expect(store.findActiveIndex(items, 'missing')).toBe(0)
    })

    it('returns 0 when URL is undefined', () => {
      const store = useJobOutputStore()
      const items = [createResultItem('a'), createResultItem('b')]

      expect(store.findActiveIndex(items, undefined)).toBe(0)
    })
  })

  describe('getOutputsForTask', () => {
    it('returns previewable outputs directly when no lazy load needed', async () => {
      const store = useJobOutputStore()
      const outputs = [createResultItem('p-1'), createResultItem('p-2')]
      const task = createTask(undefined, outputs, 1)

      const result = await store.getOutputsForTask(task)

      expect(result).toEqual(outputs)
    })

    it('lazy loads when outputsCount > 1', async () => {
      const store = useJobOutputStore()
      const previewOutput = createResultItem('preview')
      const fullOutputs = [
        createResultItem('full-1'),
        createResultItem('full-2')
      ]

      const job = createMockJob('task-1', 3)
      const task = new TaskItemImpl(job, {}, [previewOutput])
      const loadedTask = new TaskItemImpl(job, {}, fullOutputs)
      task.loadFullOutputs = vi.fn().mockResolvedValue(loadedTask)

      const result = await store.getOutputsForTask(task)

      expect(result).toEqual(fullOutputs)
      expect(task.loadFullOutputs).toHaveBeenCalled()
    })

    it('caches loaded tasks', async () => {
      const store = useJobOutputStore()
      const fullOutputs = [createResultItem('full-1')]

      const job = createMockJob('task-1', 3)
      const task = new TaskItemImpl(job, {}, [createResultItem('preview')])
      const loadedTask = new TaskItemImpl(job, {}, fullOutputs)
      task.loadFullOutputs = vi.fn().mockResolvedValue(loadedTask)

      // First call should load
      await store.getOutputsForTask(task)
      expect(task.loadFullOutputs).toHaveBeenCalledTimes(1)

      // Second call should use cache
      await store.getOutputsForTask(task)
      expect(task.loadFullOutputs).toHaveBeenCalledTimes(1)
    })

    it('falls back to preview outputs on load error', async () => {
      const store = useJobOutputStore()
      const previewOutput = createResultItem('preview')

      const job = createMockJob('task-1', 3)
      const task = new TaskItemImpl(job, {}, [previewOutput])
      task.loadFullOutputs = vi
        .fn()
        .mockRejectedValue(new Error('Network error'))

      const result = await store.getOutputsForTask(task)

      expect(result).toEqual([previewOutput])
    })
  })

  describe('clearCache', () => {
    it('clears all cached tasks', async () => {
      const store = useJobOutputStore()
      const fullOutputs = [createResultItem('full-1')]

      const job = createMockJob('task-1', 3)
      const task = new TaskItemImpl(job, {}, [createResultItem('preview')])
      const loadedTask = new TaskItemImpl(job, {}, fullOutputs)
      task.loadFullOutputs = vi.fn().mockResolvedValue(loadedTask)

      // Load and cache
      await store.getOutputsForTask(task)
      expect(task.loadFullOutputs).toHaveBeenCalledTimes(1)

      // Clear cache
      store.clearCache()

      // Should load again after clear
      await store.getOutputsForTask(task)
      expect(task.loadFullOutputs).toHaveBeenCalledTimes(2)
    })
  })

  describe('getJobDetail', () => {
    it('fetches and caches job detail', async () => {
      const { fetchJobDetail } =
        await import('@/platform/remote/comfyui/jobs/fetchJobs')
      const store = useJobOutputStore()

      const mockDetail: JobDetail = {
        id: 'job-1',
        status: 'completed',
        create_time: Date.now(),
        priority: 0,
        outputs: {}
      }
      vi.mocked(fetchJobDetail).mockResolvedValue(mockDetail)

      const mockFetchApi = vi.fn()
      const result = await store.getJobDetail(mockFetchApi, 'job-1')

      expect(result).toEqual(mockDetail)
      expect(fetchJobDetail).toHaveBeenCalledWith(mockFetchApi, 'job-1')
    })

    it('returns cached job detail on subsequent calls', async () => {
      const { fetchJobDetail } =
        await import('@/platform/remote/comfyui/jobs/fetchJobs')
      const store = useJobOutputStore()

      const mockDetail: JobDetail = {
        id: 'job-2',
        status: 'completed',
        create_time: Date.now(),
        priority: 0,
        outputs: {}
      }
      vi.mocked(fetchJobDetail).mockResolvedValue(mockDetail)

      const mockFetchApi = vi.fn()

      // First call
      await store.getJobDetail(mockFetchApi, 'job-2')
      expect(fetchJobDetail).toHaveBeenCalledTimes(1)

      // Second call should use cache
      const result = await store.getJobDetail(mockFetchApi, 'job-2')
      expect(result).toEqual(mockDetail)
      expect(fetchJobDetail).toHaveBeenCalledTimes(1)
    })

    it('returns undefined on fetch error', async () => {
      const { fetchJobDetail } =
        await import('@/platform/remote/comfyui/jobs/fetchJobs')
      const store = useJobOutputStore()

      vi.mocked(fetchJobDetail).mockRejectedValue(new Error('Network error'))

      const mockFetchApi = vi.fn()
      const result = await store.getJobDetail(mockFetchApi, 'job-error')

      expect(result).toBeUndefined()
    })
  })

  describe('getJobWorkflow', () => {
    it('fetches job detail and extracts workflow', async () => {
      const { fetchJobDetail, extractWorkflow } =
        await import('@/platform/remote/comfyui/jobs/fetchJobs')
      const store = useJobOutputStore()

      const mockDetail: JobDetail = {
        id: 'job-wf',
        status: 'completed',
        create_time: Date.now(),
        priority: 0,
        outputs: {}
      }
      const mockWorkflow = { version: 1 }

      vi.mocked(fetchJobDetail).mockResolvedValue(mockDetail)
      vi.mocked(extractWorkflow).mockReturnValue(mockWorkflow as any)

      const mockFetchApi = vi.fn()
      const result = await store.getJobWorkflow(mockFetchApi, 'job-wf')

      expect(result).toEqual(mockWorkflow)
      expect(extractWorkflow).toHaveBeenCalledWith(mockDetail)
    })

    it('returns undefined when job detail not found', async () => {
      const { fetchJobDetail, extractWorkflow } =
        await import('@/platform/remote/comfyui/jobs/fetchJobs')
      const store = useJobOutputStore()

      vi.mocked(fetchJobDetail).mockResolvedValue(undefined)
      vi.mocked(extractWorkflow).mockReturnValue(undefined)

      const mockFetchApi = vi.fn()
      const result = await store.getJobWorkflow(mockFetchApi, 'missing')

      expect(result).toBeUndefined()
    })
  })

  describe('clearJobDetailCache', () => {
    it('clears job detail cache', async () => {
      const { fetchJobDetail } =
        await import('@/platform/remote/comfyui/jobs/fetchJobs')
      const store = useJobOutputStore()

      const mockDetail: JobDetail = {
        id: 'job-clear',
        status: 'completed',
        create_time: Date.now(),
        priority: 0,
        outputs: {}
      }
      vi.mocked(fetchJobDetail).mockResolvedValue(mockDetail)

      const mockFetchApi = vi.fn()

      // Cache the detail
      await store.getJobDetail(mockFetchApi, 'job-clear')
      expect(fetchJobDetail).toHaveBeenCalledTimes(1)

      // Clear cache
      store.clearJobDetailCache()

      // Should fetch again
      await store.getJobDetail(mockFetchApi, 'job-clear')
      expect(fetchJobDetail).toHaveBeenCalledTimes(2)
    })
  })

  describe('clearAllCaches', () => {
    it('clears both task and job detail caches', async () => {
      const { fetchJobDetail } =
        await import('@/platform/remote/comfyui/jobs/fetchJobs')
      const store = useJobOutputStore()

      // Setup task cache
      const fullOutputs = [createResultItem('full-1')]
      const job = createMockJob('task-all', 3)
      const task = new TaskItemImpl(job, {}, [createResultItem('preview')])
      const loadedTask = new TaskItemImpl(job, {}, fullOutputs)
      task.loadFullOutputs = vi.fn().mockResolvedValue(loadedTask)

      // Setup job detail cache
      const mockDetail: JobDetail = {
        id: 'job-all',
        status: 'completed',
        create_time: Date.now(),
        priority: 0,
        outputs: {}
      }
      vi.mocked(fetchJobDetail).mockResolvedValue(mockDetail)

      const mockFetchApi = vi.fn()

      // Populate both caches
      await store.getOutputsForTask(task)
      await store.getJobDetail(mockFetchApi, 'job-all')

      expect(task.loadFullOutputs).toHaveBeenCalledTimes(1)
      expect(fetchJobDetail).toHaveBeenCalledTimes(1)

      // Clear all caches
      store.clearAllCaches()

      // Both should fetch again
      await store.getOutputsForTask(task)
      await store.getJobDetail(mockFetchApi, 'job-all')

      expect(task.loadFullOutputs).toHaveBeenCalledTimes(2)
      expect(fetchJobDetail).toHaveBeenCalledTimes(2)
    })
  })
})
