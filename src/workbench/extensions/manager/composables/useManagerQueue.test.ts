import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Ref } from 'vue'
import { ref } from 'vue'

import { useManagerQueue } from '@/workbench/extensions/manager/composables/useManagerQueue'
import type { components } from '@/workbench/extensions/manager/types/generatedManagerTypes'

const mockAppApi = vi.hoisted(() => ({
  addEventListener: vi.fn((type: string, listener: EventListener) => {
    mockAppApi.listeners.set(type, listener)
  }),
  listeners: new Map<string, EventListener>(),
  removeEventListener: vi.fn((type: string, listener: EventListener) => {
    if (mockAppApi.listeners.get(type) === listener) {
      mockAppApi.listeners.delete(type)
    }
  })
}))

vi.mock('@/scripts/app', () => ({
  app: {
    api: {
      addEventListener: mockAppApi.addEventListener,
      removeEventListener: mockAppApi.removeEventListener,
      clientId: 'test-client-id'
    }
  }
}))

type ManagerTaskHistory = Record<
  string,
  components['schemas']['TaskHistoryItem']
>
type ManagerTaskQueue = components['schemas']['TaskStateMessage']
type QueueTaskItem = components['schemas']['QueueTaskItem']

function createQueueTask(
  uiId: string,
  clientId = 'test-client-id'
): QueueTaskItem {
  return {
    ui_id: uiId,
    client_id: clientId,
    kind: 'install',
    params: {
      id: uiId,
      version: '1.0.0',
      selected_version: '1.0.0',
      mode: 'remote',
      channel: 'default'
    }
  }
}

function createTaskState(
  overrides: Partial<ManagerTaskQueue> = {}
): ManagerTaskQueue {
  return {
    history: {},
    running_queue: [],
    pending_queue: [],
    installed_packs: {},
    ...overrides
  }
}

function dispatchManagerEvent(type: string, detail: unknown) {
  const listener = mockAppApi.listeners.get(type)
  if (!listener) throw new Error(`Missing listener for ${type}`)
  listener(new CustomEvent(type, { detail }))
}

describe('useManagerQueue', () => {
  let taskHistory: Ref<ManagerTaskHistory>
  let taskQueue: Ref<ManagerTaskQueue>
  let installedPacks: Ref<
    Record<string, components['schemas']['ManagerPackInstalled']>
  >

  const createManagerQueue = () => {
    taskHistory = ref<ManagerTaskHistory>({})
    taskQueue = ref<ManagerTaskQueue>({
      history: {},
      running_queue: [],
      pending_queue: [],
      installed_packs: {}
    })
    installedPacks = ref({})

    return useManagerQueue(taskHistory, taskQueue, installedPacks)
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockAppApi.listeners.clear()
  })

  afterEach(() => {
    vi.clearAllMocks()
    mockAppApi.listeners.clear()
  })

  describe('initialization', () => {
    it('should initialize with empty state', () => {
      const queue = createManagerQueue()

      expect(queue.currentQueueLength.value).toBe(0)
      expect(queue.allTasksDone.value).toBe(true)
      expect(queue.isProcessing.value).toBe(false)
      expect(queue.historyCount.value).toBe(0)
    })
  })

  describe('task state management', () => {
    it('should track task queue length', () => {
      const queue = createManagerQueue()

      // Add tasks to queue
      taskQueue.value.running_queue = [
        {
          ui_id: 'task1',
          client_id: 'test-client-id',
          kind: 'install',
          params: {
            id: 'pack1',
            version: '1.0.0',
            selected_version: '1.0.0',
            mode: 'remote' as const,
            channel: 'default' as const
          }
        }
      ]
      taskQueue.value.pending_queue = [
        {
          ui_id: 'task2',
          client_id: 'test-client-id',
          kind: 'install',
          params: {
            id: 'pack2',
            version: '1.0.0',
            selected_version: '1.0.0',
            mode: 'remote' as const,
            channel: 'default' as const
          }
        }
      ]

      expect(queue.currentQueueLength.value).toBe(2)
      expect(queue.allTasksDone.value).toBe(false)
    })

    it('should handle empty queues', () => {
      const queue = createManagerQueue()

      taskQueue.value.running_queue = []
      taskQueue.value.pending_queue = []

      expect(queue.currentQueueLength.value).toBe(0)
      expect(queue.allTasksDone.value).toBe(true)
    })
  })

  describe('task history management', () => {
    it('should track task history count', () => {
      const queue = createManagerQueue()

      taskHistory.value = {
        task1: {
          ui_id: 'task1',
          client_id: 'test-client-id',
          kind: 'install',
          timestamp: '2024-01-01T00:00:00Z',
          result: 'success',
          status: { status_str: 'success', completed: true, messages: [] }
        },
        task2: {
          ui_id: 'task2',
          client_id: 'test-client-id',
          kind: 'install',
          timestamp: '2024-01-01T00:00:00Z',
          result: 'success',
          status: { status_str: 'success', completed: true, messages: [] }
        }
      }

      expect(queue.historyCount.value).toBe(2)
    })

    it('should filter tasks by client ID', () => {
      const queue = createManagerQueue()

      const mockState = {
        history: {
          task1: {
            ui_id: 'task1',
            client_id: 'test-client-id', // This client
            kind: 'install',
            timestamp: '2024-01-01T00:00:00Z',
            result: 'success',
            status: {
              status_str: 'success' as const,
              completed: true,
              messages: []
            }
          },
          task2: {
            ui_id: 'task2',
            client_id: 'other-client-id', // Different client
            kind: 'install',
            timestamp: '2024-01-01T00:00:00Z',
            result: 'success',
            status: {
              status_str: 'success' as const,
              completed: true,
              messages: []
            }
          }
        },
        running_queue: [],
        pending_queue: [],
        installed_packs: {}
      }

      queue.updateTaskState(mockState)

      // Should only include task from this client
      expect(taskHistory.value).toHaveProperty('task1')
      expect(taskHistory.value).not.toHaveProperty('task2')
    })

    it('normalizes pack IDs when updating installed packs', () => {
      const queue = createManagerQueue()

      const mockState = {
        history: {},
        running_queue: [],
        pending_queue: [],
        installed_packs: {
          'ComfyUI-GGUF@1_1_4': {
            enabled: false,
            cnr_id: 'ComfyUI-GGUF',
            ver: '1.1.4'
          },
          'test-pack': {
            enabled: true,
            cnr_id: 'test-pack',
            ver: '2.0.0'
          }
        }
      }

      queue.updateTaskState(mockState)

      // Packs should be accessible by normalized keys
      expect(installedPacks.value['ComfyUI-GGUF']).toEqual({
        enabled: false,
        cnr_id: 'ComfyUI-GGUF',
        ver: '1.1.4'
      })
      expect(installedPacks.value['test-pack']).toEqual({
        enabled: true,
        cnr_id: 'test-pack',
        ver: '2.0.0'
      })

      // Version suffixed keys should not exist after normalization
      // The pack should be accessible by its base name only (without @version)
      expect(installedPacks.value['ComfyUI-GGUF@1_1_4']).toBeUndefined()
    })

    it('handles empty installed_packs gracefully', () => {
      const queue = createManagerQueue()

      const mockState = {
        history: {},
        running_queue: [],
        pending_queue: [],
        installed_packs: undefined!
      } satisfies Partial<ManagerTaskQueue> as ManagerTaskQueue

      // Just call the function - if it throws, the test will fail automatically
      queue.updateTaskState(mockState)

      // installedPacks should remain unchanged
      expect(installedPacks.value).toEqual({})
    })

    it('updates task state from task started websocket events', () => {
      const queue = createManagerQueue()

      dispatchManagerEvent('cm-task-started', {
        state: createTaskState({
          running_queue: [createQueueTask('running-task')],
          pending_queue: [createQueueTask('other-client-task', 'other-client')]
        })
      })

      expect(taskQueue.value.running_queue).toEqual([
        createQueueTask('running-task')
      ])
      expect(taskQueue.value.pending_queue).toEqual([])
      expect(queue.currentQueueLength.value).toBe(1)
      expect(queue.isProcessing.value).toBe(true)
      expect(queue.allTasksDone.value).toBe(false)
    })

    it('updates task state from task completed websocket events', () => {
      const queue = createManagerQueue()

      dispatchManagerEvent('cm-task-completed', {
        state: createTaskState({
          history: {
            completed: {
              ui_id: 'completed',
              client_id: 'test-client-id',
              kind: 'install',
              timestamp: '2024-01-01T00:00:00Z',
              result: 'success'
            }
          }
        })
      })

      expect(queue.historyCount.value).toBe(1)
      expect(taskHistory.value).toHaveProperty('completed')
    })

    it('ignores malformed websocket events', () => {
      const queue = createManagerQueue()

      dispatchManagerEvent('cm-task-started', {
        state: undefined
      })
      dispatchManagerEvent('cm-task-completed', {})

      expect(queue.currentQueueLength.value).toBe(0)
      expect(queue.historyCount.value).toBe(0)
    })

    it('removes websocket listeners and resets local flags on cleanup', () => {
      const queue = createManagerQueue()
      queue.isLoading.value = true
      queue.updateTaskState(
        createTaskState({
          running_queue: [createQueueTask('running-task')]
        })
      )

      queue.cleanup()

      expect(queue.isLoading.value).toBe(false)
      expect(queue.isProcessing.value).toBe(false)
      expect(mockAppApi.removeEventListener).toHaveBeenCalledWith(
        'cm-task-completed',
        expect.any(Function),
        undefined
      )
      expect(mockAppApi.removeEventListener).toHaveBeenCalledWith(
        'cm-task-started',
        expect.any(Function),
        undefined
      )
    })
  })
})
