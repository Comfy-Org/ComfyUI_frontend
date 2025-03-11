import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { useManagerQueue } from '@/composables/useManagerQueue'
import { api } from '@/scripts/api'

vi.mock('@/scripts/api', () => ({
  api: {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn()
  }
}))

describe('useManagerQueue', () => {
  const createMockJob = (result: any = 'result') => ({
    job: vi.fn().mockResolvedValue(result),
    onComplete: vi.fn()
  })

  const createQueueWithMockJob = () => {
    const queue = useManagerQueue()
    const mockJob = createMockJob()
    queue.enqueueJob(mockJob)
    return { queue, mockJob }
  }

  const getEventListenerCallback = () =>
    vi.mocked(api.addEventListener).mock.calls[0][1]

  const simulateServerStatus = async (status: 'done' | 'in_progress') => {
    const event = new CustomEvent('cm-queue-status', {
      detail: { status }
    })
    getEventListenerCallback()!(event as any)
    await nextTick()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('initialization', () => {
    it('should initialize with empty queue and DONE status', () => {
      const queue = useManagerQueue()

      expect(queue.queueLength.value).toBe(0)
      expect(queue.statusMessage.value).toBe('done')
      expect(queue.allJobsDone.value).toBe(true)
    })
  })

  describe('queue management', () => {
    it('should add jobs to the queue', () => {
      const queue = useManagerQueue()
      const mockJob = createMockJob()

      queue.enqueueJob(mockJob)

      expect(queue.queueLength.value).toBe(1)
      expect(queue.allJobsDone.value).toBe(false)
    })

    it('should clear the queue when clearQueue is called', () => {
      const queue = useManagerQueue()

      // Add some jobs
      queue.enqueueJob(createMockJob())
      queue.enqueueJob(createMockJob())

      expect(queue.queueLength.value).toBe(2)

      // Clear the queue
      queue.clearQueue()

      expect(queue.queueLength.value).toBe(0)
      expect(queue.allJobsDone.value).toBe(true)
    })
  })

  describe('server status handling', () => {
    it('should update server status when receiving websocket events', async () => {
      const queue = useManagerQueue()

      await simulateServerStatus('in_progress')

      expect(queue.statusMessage.value).toBe('in_progress')
      expect(queue.allJobsDone.value).toBe(false)
    })

    it('should handle invalid status values gracefully', async () => {
      const queue = useManagerQueue()

      // Simulate an invalid status
      const event = new CustomEvent('cm-queue-status', {
        detail: null as any
      })

      getEventListenerCallback()!(event)
      await nextTick()

      // Should maintain the default status
      expect(queue.statusMessage.value).toBe('done')
    })

    it('should handle missing status property gracefully', async () => {
      const queue = useManagerQueue()

      // Simulate a detail object without status property
      const event = new CustomEvent('cm-queue-status', {
        detail: { someOtherProperty: 'value' } as any
      })

      getEventListenerCallback()!(event)
      await nextTick()

      // Should maintain the default status
      expect(queue.statusMessage.value).toBe('done')
    })
  })

  describe('job execution', () => {
    it('should start the next job when server is idle and queue has items', async () => {
      const { queue, mockJob } = createQueueWithMockJob()

      await simulateServerStatus('done')

      // Job should have been started
      expect(mockJob.job).toHaveBeenCalled()
      expect(queue.queueLength.value).toBe(0)
    })

    it('should execute onComplete callback when job completes and server becomes idle', async () => {
      const { queue, mockJob } = createQueueWithMockJob()

      // Start the job
      await simulateServerStatus('done')
      expect(mockJob.job).toHaveBeenCalled()

      // Simulate job completion
      await mockJob.job.mock.results[0].value

      // Simulate server cycle (in_progress -> done)
      await simulateServerStatus('in_progress')
      expect(mockJob.onComplete).not.toHaveBeenCalled()

      await simulateServerStatus('done')
      expect(mockJob.onComplete).toHaveBeenCalled()
    })

    it('should handle jobs without onComplete callback', async () => {
      const queue = useManagerQueue()
      const mockJob = { job: vi.fn().mockResolvedValue('result') }

      queue.enqueueJob(mockJob)

      // Start the job
      await simulateServerStatus('done')
      expect(mockJob.job).toHaveBeenCalled()

      // Simulate job completion
      await mockJob.job.mock.results[0].value

      // Simulate server cycle
      await simulateServerStatus('in_progress')
      await simulateServerStatus('done')

      // Should not throw errors even without onComplete
      expect(queue.allJobsDone.value).toBe(true)
    })

    it('should process multiple jobs in sequence', async () => {
      const queue = useManagerQueue()
      const mockJob1 = createMockJob('result1')
      const mockJob2 = createMockJob('result2')

      // Add jobs to the queue
      queue.enqueueJob(mockJob1)
      queue.enqueueJob(mockJob2)
      expect(queue.queueLength.value).toBe(2)

      // Process first job
      await simulateServerStatus('done')
      expect(mockJob1.job).toHaveBeenCalled()
      expect(queue.queueLength.value).toBe(1)

      // Complete first job
      await mockJob1.job.mock.results[0].value
      await simulateServerStatus('in_progress')
      await simulateServerStatus('done')
      expect(mockJob1.onComplete).toHaveBeenCalled()

      // Process second job
      expect(mockJob2.job).toHaveBeenCalled()
      expect(queue.queueLength.value).toBe(0)

      // Complete second job
      await mockJob2.job.mock.results[0].value
      await simulateServerStatus('in_progress')
      await simulateServerStatus('done')
      expect(mockJob2.onComplete).toHaveBeenCalled()

      // Queue should be empty and all jobs done
      expect(queue.queueLength.value).toBe(0)
      expect(queue.allJobsDone.value).toBe(true)
    })

    it('should handle job that returns rejected promise', async () => {
      const queue = useManagerQueue()
      const mockJob = {
        job: vi.fn().mockRejectedValue(new Error('Job failed')),
        onComplete: vi.fn()
      }

      queue.enqueueJob(mockJob)

      // Start the job
      await simulateServerStatus('done')
      expect(mockJob.job).toHaveBeenCalled()

      // Let the promise rejection happen
      try {
        await mockJob.job()
      } catch (e) {
        // Ignore the error
      }

      // Simulate server cycle
      await simulateServerStatus('in_progress')
      await simulateServerStatus('done')

      // onComplete should not be called for failed jobs
      expect(mockJob.onComplete).not.toHaveBeenCalled()
    })

    it('should handle adding jobs while processing is in progress', async () => {
      const queue = useManagerQueue()
      const mockJob1 = createMockJob()
      const mockJob2 = createMockJob()

      // Add first job and start processing
      queue.enqueueJob(mockJob1)
      await simulateServerStatus('done')
      expect(mockJob1.job).toHaveBeenCalled()

      // Add second job while first is processing
      queue.enqueueJob(mockJob2)
      expect(queue.queueLength.value).toBe(1)

      // Complete first job
      await mockJob1.job.mock.results[0].value
      await simulateServerStatus('in_progress')
      await simulateServerStatus('done')

      // Second job should now be processed
      expect(mockJob2.job).toHaveBeenCalled()
    })

    it('should handle server status changes without jobs in queue', async () => {
      const queue = useManagerQueue()

      // Cycle server status without any jobs
      await simulateServerStatus('in_progress')
      await simulateServerStatus('done')
      await simulateServerStatus('in_progress')
      await simulateServerStatus('done')

      // Should not cause any errors
      expect(queue.allJobsDone.value).toBe(true)
    })
  })
})
