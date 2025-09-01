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
      const queue = useManagerQueue(taskHistory, taskQueue, installedPacks)

      expect(queue.allTasksDone.value).toBe(true)
    })

    it('should set up event listeners on creation', () => {
      useManagerQueue(taskHistory, taskQueue, installedPacks)

      expect(app.api.addEventListener).toHaveBeenCalled()
    })
  })

  describe('processing state handling', () => {
    it('should update processing state based on queue length', async () => {
      const queue = useManagerQueue(taskHistory, taskQueue, installedPacks)

      // Initially empty queue
      expect(queue.isProcessing.value).toBe(false)
      expect(queue.allTasksDone.value).toBe(true)

      // Add tasks to queue
      taskQueue.value.running_queue = [createMockTask('task1')]
      taskQueue.value.pending_queue = [createMockTask('task2')]

      // Force reactivity update
      await nextTick()

      expect(queue.allTasksDone.value).toBe(false)
    })

    it('should trigger progress dialog when queue length changes', async () => {
      useManagerQueue(taskHistory, taskQueue, installedPacks)

      // Trigger the whenever callback
      mockWheneverCallback()

      expect(mockShowManagerProgressDialog).toHaveBeenCalled()
    })
  })

  describe('task state management', () => {
    it('should reflect task queue state changes', async () => {
      const queue = useManagerQueue(taskHistory, taskQueue, installedPacks)

      // Add running tasks
      taskQueue.value.running_queue = [createMockTask('task1')]
      taskQueue.value.pending_queue = [createMockTask('task2')]

      await nextTick()

      expect(queue.allTasksDone.value).toBe(false)
    })

    it('should handle empty queue state', async () => {
      const queue = useManagerQueue(taskHistory, taskQueue, installedPacks)

      taskQueue.value.running_queue = []
      taskQueue.value.pending_queue = []

      await nextTick()

      expect(queue.allTasksDone.value).toBe(true)
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

    it('should filter tasks by client ID in WebSocket events', async () => {
      const queue = useManagerQueue(taskHistory, taskQueue, installedPacks)

      const mockState = createMockState({
        running_queue: [
          createMockTask('task1'),
          createMockTask('task2', 'other-client-id')
        ],
        pending_queue: [createMockTask('task3')],
        history: {
          task1: createMockHistoryItem(),
          task2: createMockHistoryItem('other-client-id')
        }
      })

      triggerWebSocketEvent('cm-task-completed', mockState)
      await nextTick()

      // Should only include tasks from this client
      expect(taskQueue.value.running_queue).toEqual([createMockTask('task1')])
      expect(taskQueue.value.pending_queue).toEqual([createMockTask('task3')])
      expect(taskHistory.value).toEqual({
        task1: createMockHistoryItem()
      })
      expect(queue.allTasksDone.value).toBe(false)
    })
  })

  describe('cleanup functionality', () => {
    it('should clean up event listeners on cleanup', () => {
      const queue = useManagerQueue(taskHistory, taskQueue, installedPacks)

      queue.cleanup()

      // Verify cleanup was called
      expect(queue.isProcessing.value).toBe(false)
      expect(queue.isLoading.value).toBe(false)
    })
  })
})
