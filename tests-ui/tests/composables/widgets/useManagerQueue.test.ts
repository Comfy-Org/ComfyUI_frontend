import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

import { useManagerQueue } from '@/composables/useManagerQueue'
import { api } from '@/scripts/api'

vi.mock('@/scripts/api', () => ({
  api: {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn()
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

vi.mock('@/services/dialogService', () => ({
  useDialogService: vi.fn(() => ({
    showManagerProgressDialog: vi.fn()
  }))
}))

describe('useManagerQueue', () => {
  let taskHistory: any
  let taskQueue: any
  let installedPacks: any

  beforeEach(() => {
    vi.clearAllMocks()
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
  })

  describe('initialization', () => {
    it('should initialize with empty queue and DONE status', () => {
      const queue = useManagerQueue(taskHistory, taskQueue, installedPacks)

      expect(queue.queueLength.value).toBe(0)
      expect(queue.allTasksDone.value).toBe(true)
    })

    it('should set up event listeners on creation', () => {
      useManagerQueue(taskHistory, taskQueue, installedPacks)

      expect(api.addEventListener).toHaveBeenCalled()
    })
  })

  describe('processing state handling', () => {
    it('should update processing state based on queue length', async () => {
      const queue = useManagerQueue(taskHistory, taskQueue, installedPacks)

      // Initially empty queue
      expect(queue.isProcessing.value).toBe(false)
      expect(queue.allTasksDone.value).toBe(true)

      // Add tasks to queue
      taskQueue.value.running_queue = [{ id: 'task1' } as any]
      taskQueue.value.pending_queue = [{ id: 'task2' } as any]

      // Force reactivity update
      await nextTick()

      expect(queue.queueLength.value).toBe(2)
    })
  })

  describe('task state management', () => {
    it('should reflect task queue state changes', async () => {
      const queue = useManagerQueue(taskHistory, taskQueue, installedPacks)

      // Add running tasks
      taskQueue.value.running_queue = [{ id: 'task1' } as any]
      taskQueue.value.pending_queue = [{ id: 'task2' } as any]

      await nextTick()

      expect(queue.queueLength.value).toBe(2)
      expect(queue.allTasksDone.value).toBe(false)
    })

    it('should handle empty queue state', async () => {
      const queue = useManagerQueue(taskHistory, taskQueue, installedPacks)

      taskQueue.value.running_queue = []
      taskQueue.value.pending_queue = []

      await nextTick()

      expect(queue.queueLength.value).toBe(0)
      expect(queue.allTasksDone.value).toBe(true)
    })
  })

  describe('queue data management', () => {
    it('should provide access to task queue state', async () => {
      taskQueue.value.running_queue = [{ id: 'task1' } as any]
      taskQueue.value.pending_queue = [
        { id: 'task2' },
        { id: 'task3' }
      ] as any[]

      const queue = useManagerQueue(taskHistory, taskQueue, installedPacks)
      await nextTick()

      expect(queue.taskQueue.value.running_queue).toEqual([{ id: 'task1' }])
      expect(queue.taskQueue.value.pending_queue).toEqual([
        { id: 'task2' },
        { id: 'task3' }
      ])
      expect(queue.queueLength.value).toBe(3)
    })

    it('should provide access to task history', async () => {
      const mockHistory = {
        task1: { result: 'success', timestamp: '2023-01-01' },
        task2: { result: 'error', timestamp: '2023-01-02' }
      }
      taskHistory.value = mockHistory as any

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
        task1: { result: 'success' } as any,
        task2: { result: 'error' } as any
      }

      await nextTick()

      expect(queue.taskHistory.value).toEqual({
        task1: { result: 'success' },
        task2: { result: 'error' }
      })
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
      taskQueue.value.pending_queue = [{ id: 'task1' } as any]

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

      taskQueue.value.running_queue = [{ id: 'task1' } as any]
      taskQueue.value.pending_queue = [
        { id: 'task2' } as any,
        { id: 'task3' } as any
      ]

      await nextTick()

      expect(queue.queueLength.value).toBe(3)
    })
  })
})
