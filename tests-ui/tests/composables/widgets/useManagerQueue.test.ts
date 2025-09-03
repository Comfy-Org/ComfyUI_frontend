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
  const createMockTask = (result: any = 'result') => ({
    task: vi.fn().mockResolvedValue(result),
    onComplete: vi.fn()
  })

  const createQueueWithMockTask = () => {
    const queue = useManagerQueue()
    const mockTask = createMockTask()
    queue.enqueueTask(mockTask)
    return { queue, mockTask }
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
      expect(queue.allTasksDone.value).toBe(true)
    })
  })

  describe('queue management', () => {
    it('should add tasks to the queue', () => {
      const queue = useManagerQueue()
      const mockTask = createMockTask()

      queue.enqueueTask(mockTask)

      expect(queue.queueLength.value).toBe(1)
      expect(queue.allTasksDone.value).toBe(false)
    })

    it('should clear the queue when clearQueue is called', () => {
      const queue = useManagerQueue()

      // Add some tasks
      queue.enqueueTask(createMockTask())
      queue.enqueueTask(createMockTask())

      expect(queue.queueLength.value).toBe(2)

      // Clear the queue
      queue.clearQueue()

      expect(queue.queueLength.value).toBe(0)
      expect(queue.allTasksDone.value).toBe(true)
    })
  })

  describe('server status handling', () => {
    it('should update server status when receiving websocket events', async () => {
      const queue = useManagerQueue()

      await simulateServerStatus('in_progress')

      expect(queue.statusMessage.value).toBe('in_progress')
      expect(queue.allTasksDone.value).toBe(false)
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

  describe('task execution', () => {
    it('should start the next task when server is idle and queue has items', async () => {
      const { queue, mockTask } = createQueueWithMockTask()

      await simulateServerStatus('done')

      // Task should have been started
      expect(mockTask.task).toHaveBeenCalled()
      expect(queue.queueLength.value).toBe(0)
    })

    it('should execute onComplete callback when task completes and server becomes idle', async () => {
      const { mockTask } = createQueueWithMockTask()

      // Start the task
      await simulateServerStatus('done')
      expect(mockTask.task).toHaveBeenCalled()

      // Simulate task completion
      await mockTask.task.mock.results[0].value

      // Simulate server cycle (in_progress -> done)
      await simulateServerStatus('in_progress')
      expect(mockTask.onComplete).not.toHaveBeenCalled()

      await simulateServerStatus('done')
      expect(mockTask.onComplete).toHaveBeenCalled()
    })

    it('should handle tasks without onComplete callback', async () => {
      const queue = useManagerQueue()
      const mockTask = { task: vi.fn().mockResolvedValue('result') }

      queue.enqueueTask(mockTask)

      // Start the task
      await simulateServerStatus('done')
      expect(mockTask.task).toHaveBeenCalled()

      // Simulate task completion
      await mockTask.task.mock.results[0].value

      // Simulate server cycle
      await simulateServerStatus('in_progress')
      await simulateServerStatus('done')

      // Should not throw errors even without onComplete
      expect(queue.allTasksDone.value).toBe(true)
    })

    it('should process multiple tasks in sequence', async () => {
      const queue = useManagerQueue()
      const mockTask1 = createMockTask('result1')
      const mockTask2 = createMockTask('result2')

      // Add tasks to the queue
      queue.enqueueTask(mockTask1)
      queue.enqueueTask(mockTask2)
      expect(queue.queueLength.value).toBe(2)

      // Process first task
      await simulateServerStatus('done')
      expect(mockTask1.task).toHaveBeenCalled()
      expect(queue.queueLength.value).toBe(1)

      // Complete first task
      await mockTask1.task.mock.results[0].value
      await simulateServerStatus('in_progress')
      await simulateServerStatus('done')
      expect(mockTask1.onComplete).toHaveBeenCalled()

      // Process second task
      expect(mockTask2.task).toHaveBeenCalled()
      expect(queue.queueLength.value).toBe(0)

      // Complete second task
      await mockTask2.task.mock.results[0].value
      await simulateServerStatus('in_progress')
      await simulateServerStatus('done')
      expect(mockTask2.onComplete).toHaveBeenCalled()

      // Queue should be empty and all tasks done
      expect(queue.queueLength.value).toBe(0)
      expect(queue.allTasksDone.value).toBe(true)
    })

    it('should handle task that returns rejected promise', async () => {
      const queue = useManagerQueue()
      const mockTask = {
        task: vi.fn().mockRejectedValue(new Error('Task failed')),
        onComplete: vi.fn()
      }

      queue.enqueueTask(mockTask)

      // Start the task
      await simulateServerStatus('done')
      expect(mockTask.task).toHaveBeenCalled()

      // Let the promise rejection happen
      try {
        await mockTask.task()
      } catch (e) {
        // Ignore the error
      }

      // Simulate server cycle
      await simulateServerStatus('in_progress')
      await simulateServerStatus('done')

      // onComplete should still be called for failed tasks
      expect(mockTask.onComplete).toHaveBeenCalled()
    })

    it('should handle multiple multiple tasks enqueued at once while server busy', async () => {
      const queue = useManagerQueue()
      const mockTask1 = createMockTask()
      const mockTask2 = createMockTask()
      const mockTask3 = createMockTask()

      // Three tasks enqueued at once
      await simulateServerStatus('in_progress')
      await Promise.all([
        queue.enqueueTask(mockTask1),
        queue.enqueueTask(mockTask2),
        queue.enqueueTask(mockTask3)
      ])

      // Task 1
      await simulateServerStatus('done')
      expect(mockTask1.task).toHaveBeenCalled()

      // Verify state of onComplete callbacks
      expect(mockTask1.onComplete).toHaveBeenCalled()
      expect(mockTask2.onComplete).not.toHaveBeenCalled()
      expect(mockTask3.onComplete).not.toHaveBeenCalled()

      // Verify state of queue
      expect(queue.queueLength.value).toBe(2)
      expect(queue.allTasksDone.value).toBe(false)

      // Task 2
      await simulateServerStatus('in_progress')
      await simulateServerStatus('done')
      expect(mockTask2.task).toHaveBeenCalled()

      // Verify state of onComplete callbacks
      expect(mockTask2.onComplete).toHaveBeenCalled()
      expect(mockTask3.onComplete).not.toHaveBeenCalled()

      // Verify state of queue
      expect(queue.queueLength.value).toBe(1)
      expect(queue.allTasksDone.value).toBe(false)

      // Task 3
      await simulateServerStatus('in_progress')
      await simulateServerStatus('done')

      // Verify state of onComplete callbacks
      expect(mockTask3.task).toHaveBeenCalled()
      expect(mockTask3.onComplete).toHaveBeenCalled()

      // Verify state of queue
      expect(queue.queueLength.value).toBe(0)
      expect(queue.allTasksDone.value).toBe(true)
    })

    it('should handle adding tasks while processing is in progress', async () => {
      const queue = useManagerQueue()
      const mockTask1 = createMockTask()
      const mockTask2 = createMockTask()

      // Add first task and start processing
      queue.enqueueTask(mockTask1)
      await simulateServerStatus('done')
      expect(mockTask1.task).toHaveBeenCalled()

      // Add second task while first is processing
      queue.enqueueTask(mockTask2)
      expect(queue.queueLength.value).toBe(1)

      // Complete first task
      await mockTask1.task.mock.results[0].value
      await simulateServerStatus('in_progress')
      await simulateServerStatus('done')

      // Second task should now be processed
      expect(mockTask2.task).toHaveBeenCalled()
    })

    it('should handle server status changes without tasks in queue', async () => {
      const queue = useManagerQueue()

      // Cycle server status without any tasks
      await simulateServerStatus('in_progress')
      await simulateServerStatus('done')
      await simulateServerStatus('in_progress')
      await simulateServerStatus('done')

      // Should not cause any errors
      expect(queue.allTasksDone.value).toBe(true)
    })
  })
})
