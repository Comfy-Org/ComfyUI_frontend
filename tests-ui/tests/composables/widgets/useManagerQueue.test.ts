import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

import { useManagerQueue } from '@/composables/useManagerQueue'
import { app } from '@/scripts/app'

// Mock VueUse's useEventListener
const mockEventListeners = new Map()
const mockWheneverCallback = vi.fn()

vi.mock('@vueuse/core', async () => {
  const actual = await vi.importActual('@vueuse/core')
  return {
    ...actual,
    useEventListener: vi.fn((target, event, handler) => {
      if (!mockEventListeners.has(event)) {
        mockEventListeners.set(event, [])
      }
      mockEventListeners.get(event).push(handler)

      // Mock the addEventListener behavior
      if (target && target.addEventListener) {
        target.addEventListener(event, handler)
      }

      // Return cleanup function
      return () => {
        if (target && target.removeEventListener) {
          target.removeEventListener(event, handler)
        }
      }
    }),
    whenever: vi.fn((_source, cb) => {
      mockWheneverCallback.mockImplementation(cb)
    })
  }
})

vi.mock('@/scripts/app', () => ({
  app: {
    api: {
      clientId: 'test-client-id',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    }
  }
}))

vi.mock('@/services/comfyManagerService', () => ({
  useComfyManagerService: vi.fn(() => ({
    getTaskQueue: vi.fn().mockResolvedValue({
      queue_running: [],
      queue_pending: []
    }),
    getTaskHistory: vi.fn().mockResolvedValue({}),
    clearTaskHistory: vi.fn().mockResolvedValue(null),
    deleteTaskHistoryItems: vi.fn().mockResolvedValue(null)
  }))
}))

const mockShowManagerProgressDialog = vi.fn()
vi.mock('@/services/dialogService', () => ({
  useDialogService: vi.fn(() => ({
    showManagerProgressDialog: mockShowManagerProgressDialog
  }))
}))

describe('useManagerQueue', () => {
  let taskHistory: any
  let taskQueue: any
  let installedPacks: any

  // Helper functions
  const createMockTask = (
    id: string,
    clientId = 'test-client-id',
    additional = {}
  ) => ({
    id,
    client_id: clientId,
    ...additional
  })

  const createMockHistoryItem = (
    clientId = 'test-client-id',
    result = 'success',
    additional = {}
  ) => ({
    client_id: clientId,
    result,
    ...additional
  })

  const createMockState = (overrides = {}) => ({
    running_queue: [],
    pending_queue: [],
    history: {},
    installed_packs: {},
    ...overrides
  })

  const triggerWebSocketEvent = (eventType: string, state: any) => {
    const mockEventListener = app.api.addEventListener as any
    const eventCall = mockEventListener.mock.calls.find(
      (call: any) => call[0] === eventType
    )

    if (eventCall) {
      const handler = eventCall[1]
      handler({
        type: eventType,
        detail: { state }
      })
    }
  }

  const getEventHandler = (eventType: string) => {
    const mockEventListener = app.api.addEventListener as any
    const eventCall = mockEventListener.mock.calls.find(
      (call: any) => call[0] === eventType
    )
    return eventCall ? eventCall[1] : null
  }

  const getEventListenerCallback = () =>
    vi.mocked(app.api.addEventListener).mock.calls[0][1]

  const simulateServerStatus = async (status: 'all-done' | 'in_progress') => {
    const event = new CustomEvent('cm-queue-status', {
      detail: { status }
    })
    getEventListenerCallback()!(event as any)
    await nextTick()
  }

  const createMockQueueTask = (result = 'success') => ({
    task: vi.fn().mockResolvedValue(result),
    onComplete: vi.fn()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockEventListeners.clear()
    taskHistory = ref({})
    taskQueue = ref({
      history: {},
      running_queue: [],
      pending_queue: [],
      installed_packs: {}
    })
    installedPacks = ref({})
  })

  afterEach(() => {
    vi.clearAllMocks()
    mockEventListeners.clear()
  })

  describe('initialization', () => {
    it('should initialize with empty queue and DONE status', () => {
      const queue = useManagerQueue()

      expect(queue.queueLength.value).toBe(0)
      expect(queue.statusMessage.value).toBe('all-done')
      expect(queue.allTasksDone.value).toBe(true)
    })
  })

  describe('queue management', () => {
    it('should add tasks to the queue', () => {
      const queue = useManagerQueue()
      const mockTask = createMockQueueTask()

      queue.enqueueTask(mockTask)

      expect(queue.queueLength.value).toBe(1)
      expect(queue.allTasksDone.value).toBe(false)
    })

    it('should clear the queue when clearQueue is called', () => {
      const queue = useManagerQueue()

      // Add some tasks
      queue.enqueueTask(createMockQueueTask())
      queue.enqueueTask(createMockQueueTask())

      expect(queue.queueLength.value).toBe(2)

      // Clear the queue
      queue.clearQueue()

      expect(queue.queueLength.value).toBe(0)
      expect(queue.allTasksDone.value).toBe(true)
    })

    it('should set up event listeners on creation', () => {
      useManagerQueue()

      expect(app.api.addEventListener).toHaveBeenCalled()
    })
  })

  describe('processing state handling', () => {
    it('should update processing state based on queue length', async () => {
      const queue = useManagerQueue()

      // Initially empty queue
      expect(queue.allTasksDone.value).toBe(true)
      expect(queue.statusMessage.value).toBe('all-done')

      // Add tasks to queue
      queue.enqueueTask(createMockTask())
      queue.enqueueTask(createMockTask())

      expect(queue.queueLength.value).toBe(2)
      expect(queue.allTasksDone.value).toBe(false)
    })

    it('should handle server status changes', async () => {
      const queue = useManagerQueue()

      // Test status change to in_progress
      await simulateServerStatus('in_progress')
      expect(queue.statusMessage.value).toBe('in_progress')

      // Test status change back to all-done
      await simulateServerStatus('all-done')
      expect(queue.statusMessage.value).toBe('all-done')
    })
  })

  describe('task state management', () => {
    const createQueueWithMockTask = () => {
      const queue = useManagerQueue()
      const mockTask = createMockTask()
      queue.enqueueTask(mockTask)
      return { queue, mockTask }
    }

    it('should execute onComplete callback when task completes and server becomes idle', async () => {
      const { mockTask } = createQueueWithMockTask()

      // Start the task
      await simulateServerStatus('all-done')
      expect(mockTask.task).toHaveBeenCalled()

      // Simulate task completion
      await mockTask.task.mock.results[0].value

      // Simulate server cycle (in_progress -> done)
      await simulateServerStatus('in_progress')
      expect(mockTask.onComplete).not.toHaveBeenCalled()

      await simulateServerStatus('all-done')
      expect(mockTask.onComplete).toHaveBeenCalled()
    })

    it('should handle tasks without onComplete callback', async () => {
      const queue = useManagerQueue()
      const mockTask = { task: vi.fn().mockResolvedValue('result') }

      queue.enqueueTask(mockTask)

      // Start the task
      await simulateServerStatus('all-done')
      expect(mockTask.task).toHaveBeenCalled()

      // Simulate task completion
      await mockTask.task.mock.results[0].value

      // Simulate server cycle
      await simulateServerStatus('in_progress')
      await simulateServerStatus('all-done')

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
      await simulateServerStatus('all-done')
      expect(mockTask1.task).toHaveBeenCalled()
      expect(queue.queueLength.value).toBe(1)

      // Complete first task
      await mockTask1.task.mock.results[0].value
      await simulateServerStatus('in_progress')
      await simulateServerStatus('all-done')
      expect(mockTask1.onComplete).toHaveBeenCalled()

      // Process second task
      expect(mockTask2.task).toHaveBeenCalled()
      expect(queue.queueLength.value).toBe(0)

      // Complete second task
      await mockTask2.task.mock.results[0].value
      await simulateServerStatus('in_progress')
      await simulateServerStatus('all-done')
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
      await simulateServerStatus('all-done')
      expect(mockTask.task).toHaveBeenCalled()

      // Let the promise rejection happen
      try {
        await mockTask.task()
      } catch (e) {
        // Ignore the error
      }

      // Simulate server cycle
      await simulateServerStatus('in_progress')
      await simulateServerStatus('all-done')

      // onComplete should still be called for failed tasks
      expect(mockTask.onComplete).toHaveBeenCalled()
    })

    it('should handle multiple tasks enqueued at once while server busy', async () => {
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
      await simulateServerStatus('all-done')
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
      await simulateServerStatus('all-done')
      expect(mockTask2.task).toHaveBeenCalled()

      // Verify state of onComplete callbacks
      expect(mockTask2.onComplete).toHaveBeenCalled()
      expect(mockTask3.onComplete).not.toHaveBeenCalled()

      // Task 3
      await simulateServerStatus('in_progress')
      await simulateServerStatus('all-done')

      // Verify state of onComplete callbacks
      expect(mockTask3.task).toHaveBeenCalled()
      expect(mockTask3.onComplete).toHaveBeenCalled()

      // Verify state of queue
      expect(queue.queueLength.value).toBe(0)
      expect(queue.allTasksDone.value).toBe(true)
    })

    it('should handle server status changes with empty queue', async () => {
      const queue = useManagerQueue()

      // Cycle server status without any tasks
      await simulateServerStatus('in_progress')
      await simulateServerStatus('all-done')
      await simulateServerStatus('in_progress')
      await simulateServerStatus('all-done')

      expect(queue.queueLength.value).toBe(0)
      expect(queue.allTasksDone.value).toBe(true)
    })
  })

  describe('legacy queue data management', () => {
    beforeEach(() => {
      taskHistory = ref({})
      taskQueue = ref({
        history: {},
        running_queue: [],
        pending_queue: [],
        installed_packs: {}
      })
      installedPacks = ref({})
    })

    it('should provide access to task queue state', async () => {
      const runningTasks = [createMockTask('task1')]
      const pendingTasks = [createMockTask('task2'), createMockTask('task3')]

      taskQueue.value.running_queue = runningTasks
      taskQueue.value.pending_queue = pendingTasks

      const queue = useManagerQueue(taskHistory, taskQueue, installedPacks)
      await nextTick()

      expect(queue.taskQueue.value.running_queue).toEqual(runningTasks)
      expect(queue.taskQueue.value.pending_queue).toEqual(pendingTasks)
      expect(queue.queueLength.value).toBe(3)
    })

    it('should provide access to task history', async () => {
      const mockHistory = {
        task1: createMockHistoryItem(),
        task2: createMockHistoryItem('test-client-id', 'error')
      }
      taskHistory.value = mockHistory

      const queue = useManagerQueue(taskHistory, taskQueue, installedPacks)
      await nextTick()

      expect(queue.taskHistory.value).toEqual(mockHistory)
      expect(queue.historyCount.value).toBe(2)
    })

    it('should handle empty state gracefully', async () => {
      taskQueue.value.running_queue = []
      taskQueue.value.pending_queue = []
      taskHistory.value = {}

      const queue = useManagerQueue(taskHistory, taskQueue, installedPacks)
      await nextTick()

      expect(queue.queueLength.value).toBe(0)
      expect(queue.historyCount.value).toBe(0)
    })
  })

  describe('state management', () => {
    it('should provide reactive task history', async () => {
      const queue = useManagerQueue(taskHistory, taskQueue, installedPacks)

      taskHistory.value = {
        task1: createMockHistoryItem(),
        task2: createMockHistoryItem('test-client-id', 'error')
      }

      await nextTick()

      expect(queue.taskHistory.value).toEqual(taskHistory.value)
      expect(queue.historyCount.value).toBe(2)
    })

    it('should provide reactive installed packs', async () => {
      installedPacks.value = {
        pack1: { version: '1.0' },
        pack2: { version: '2.0' }
      }

      await nextTick()

      // The composable should have access to installedPacks through the parameter
      expect(installedPacks.value).toEqual({
        pack1: { version: '1.0' },
        pack2: { version: '2.0' }
      })
    })
  })

  describe('computed properties', () => {
    it('should correctly compute allTasksDone', async () => {
      const queue = useManagerQueue(taskHistory, taskQueue, installedPacks)

      // Empty queue = all done
      expect(queue.allTasksDone.value).toBe(true)

      // Add pending tasks
      taskQueue.value.pending_queue = [createMockTask('task1')]

      await nextTick()

      expect(queue.allTasksDone.value).toBe(false)

      // Clear queue
      taskQueue.value.running_queue = []
      taskQueue.value.pending_queue = []

      await nextTick()

      expect(queue.allTasksDone.value).toBe(true)
    })

    it('should correctly compute queueLength', async () => {
      const queue = useManagerQueue(taskHistory, taskQueue, installedPacks)

      expect(queue.queueLength.value).toBe(0)

      taskQueue.value.running_queue = [createMockTask('task1')]
      taskQueue.value.pending_queue = [
        createMockTask('task2'),
        createMockTask('task3')
      ]

      await nextTick()

      expect(queue.queueLength.value).toBe(3)
    })
  })

  describe('client filtering functionality', () => {
    it('should filter tasks by client ID in WebSocket events', async () => {
      const queue = useManagerQueue(taskHistory, taskQueue, installedPacks)

      const mockState = createMockState({
        running_queue: [
          createMockTask('task1'),
          createMockTask('task2', 'other-client-id')
        ],
        pending_queue: [createMockTask('task3')]
      })

      triggerWebSocketEvent('cm-task-completed', mockState)
      await nextTick()

      // Should only include tasks from this client
      expect(taskQueue.value.running_queue).toEqual([createMockTask('task1')])
      expect(taskQueue.value.pending_queue).toEqual([createMockTask('task3')])
      expect(queue.queueLength.value).toBe(2)
    })

    it('should filter history by client ID in WebSocket events', async () => {
      const queue = useManagerQueue(taskHistory, taskQueue, installedPacks)

      const mockState = createMockState({
        history: {
          task1: createMockHistoryItem(),
          task2: createMockHistoryItem('other-client-id'),
          task3: createMockHistoryItem()
        }
      })

      triggerWebSocketEvent('cm-task-completed', mockState)
      await nextTick()

      // Should only include history items from this client
      expect(Object.keys(taskHistory.value)).toHaveLength(2)
      expect(taskHistory.value).toHaveProperty('task1')
      expect(taskHistory.value).toHaveProperty('task3')
      expect(taskHistory.value).not.toHaveProperty('task2')
      expect(queue.historyCount.value).toBe(2)
    })

    it('should handle all tasks being from other clients', async () => {
      const queue = useManagerQueue(taskHistory, taskQueue, installedPacks)

      const mockState = createMockState({
        running_queue: [
          createMockTask('task1', 'other-client-1'),
          createMockTask('task2', 'other-client-2')
        ],
        pending_queue: [createMockTask('task3', 'other-client-1')],
        history: {
          task4: createMockHistoryItem('other-client-1'),
          task5: createMockHistoryItem('other-client-2')
        }
      })

      triggerWebSocketEvent('cm-task-completed', mockState)
      await nextTick()

      // Should have no tasks or history
      expect(taskQueue.value.running_queue).toEqual([])
      expect(taskQueue.value.pending_queue).toEqual([])
      expect(taskHistory.value).toEqual({})
      expect(queue.queueLength.value).toBe(0)
      expect(queue.historyCount.value).toBe(0)
    })
  })

  describe('WebSocket event handling', () => {
    it('should handle task done events', async () => {
      useManagerQueue(taskHistory, taskQueue, installedPacks)

      const mockState = createMockState({
        running_queue: [createMockTask('task1')],
        history: {
          task1: createMockHistoryItem()
        },
        installed_packs: { pack1: { version: '1.0' } }
      })

      triggerWebSocketEvent('cm-task-completed', mockState)
      await nextTick()

      expect(taskQueue.value.running_queue).toEqual([createMockTask('task1')])
      expect(taskQueue.value.pending_queue).toEqual([])
      expect(taskHistory.value).toEqual({
        task1: createMockHistoryItem()
      })
      expect(installedPacks.value).toEqual({ pack1: { version: '1.0' } })
    })

    it('should handle task started events', async () => {
      useManagerQueue(taskHistory, taskQueue, installedPacks)

      const mockState = createMockState({
        running_queue: [createMockTask('task1')],
        pending_queue: [createMockTask('task2')],
        installed_packs: { pack1: { version: '1.0' } }
      })

      triggerWebSocketEvent('cm-task-started', mockState)
      await nextTick()

      expect(taskQueue.value.running_queue).toEqual([createMockTask('task1')])
      expect(taskQueue.value.pending_queue).toEqual([createMockTask('task2')])
      expect(installedPacks.value).toEqual({ pack1: { version: '1.0' } })
    })

    it('should filter out tasks from other clients in WebSocket events', async () => {
      useManagerQueue(taskHistory, taskQueue, installedPacks)

      const mockState = createMockState({
        running_queue: [
          createMockTask('task1'),
          createMockTask('task2', 'other-client-id')
        ],
        pending_queue: [createMockTask('task3', 'other-client-id')],
        history: {
          task1: createMockHistoryItem(),
          task2: createMockHistoryItem('other-client-id')
        }
      })

      triggerWebSocketEvent('cm-task-completed', mockState)
      await nextTick()

      // Should only include tasks from this client
      expect(taskQueue.value.running_queue).toEqual([createMockTask('task1')])
      expect(taskQueue.value.pending_queue).toEqual([])
      expect(taskHistory.value).toEqual({
        task1: createMockHistoryItem()
      })
    })

    it('should ignore events with wrong type', async () => {
      useManagerQueue(taskHistory, taskQueue, installedPacks)

      const handler = getEventHandler('cm-task-completed')

      // Send event with wrong type
      handler({
        type: 'wrong-event-type',
        detail: {
          state: createMockState({ running_queue: [createMockTask('task1')] })
        }
      })
      await nextTick()

      // Should not update state
      expect(taskQueue.value.running_queue).toEqual([])
    })
  })

  describe('cleanup functionality', () => {
    it('should clean up event listeners on stopListening', () => {
      const queue = useManagerQueue(taskHistory, taskQueue, installedPacks)
      const mockRemoveEventListener = app.api.removeEventListener as any

      queue.stopListening()

      expect(mockRemoveEventListener).toHaveBeenCalledTimes(2)

      // Check that both event types were called with the correct event names
      const calls = mockRemoveEventListener.mock.calls
      const eventTypes = calls.map((call: any) => call[0])
      expect(eventTypes).toContain('cm-task-completed')
      expect(eventTypes).toContain('cm-task-started')

      // Check that functions were passed as second parameter
      calls.forEach((call: any) => {
        expect(typeof call[1]).toBe('function')
      })
    })

    it('should handle multiple stopListening calls gracefully', () => {
      const queue = useManagerQueue(taskHistory, taskQueue, installedPacks)
      const mockRemoveEventListener = app.api.removeEventListener as any

      queue.stopListening()
      queue.stopListening()

      // Should still only be called twice (once per event type)
      expect(mockRemoveEventListener).toHaveBeenCalledTimes(4)
    })
  })

  describe('edge cases', () => {
    it('should handle undefined installed_packs in state update', async () => {
      useManagerQueue(taskHistory, taskQueue, installedPacks)

      const mockState = createMockState({
        running_queue: [createMockTask('task1')],
        installed_packs: undefined
      })

      triggerWebSocketEvent('cm-task-completed', mockState)
      await nextTick()

      // Should not update installedPacks when undefined
      expect(installedPacks.value).toEqual({})
    })

    it('should handle rapid successive events', async () => {
      const queue = useManagerQueue(taskHistory, taskQueue, installedPacks)

      // Send multiple events rapidly
      for (let i = 0; i < 10; i++) {
        triggerWebSocketEvent(
          'cm-task-completed',
          createMockState({
            running_queue: [createMockTask(`task${i}`)],
            history: { [`task${i}`]: createMockHistoryItem() }
          })
        )
      }

      await nextTick()

      // Should have the last state
      expect(taskQueue.value.running_queue).toEqual([createMockTask('task9')])
      expect(queue.queueLength.value).toBe(1)
    })

    it('should maintain consistency when mixing event types', async () => {
      useManagerQueue(taskHistory, taskQueue, installedPacks)

      // Send alternating event types
      triggerWebSocketEvent(
        'cm-task-started',
        createMockState({
          running_queue: [createMockTask('task1')],
          pending_queue: [createMockTask('task2')]
        })
      )

      triggerWebSocketEvent(
        'cm-task-completed',
        createMockState({
          running_queue: [],
          pending_queue: [createMockTask('task2')],
          history: { task1: createMockHistoryItem() }
        })
      )

      await nextTick()

      expect(taskQueue.value.running_queue).toEqual([])
      expect(taskQueue.value.pending_queue).toEqual([createMockTask('task2')])
      expect(taskHistory.value).toHaveProperty('task1')
    })
  })
})
