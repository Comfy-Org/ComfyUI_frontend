import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  HistoryTaskItem,
  PendingTaskItem,
  RunningTaskItem,
  TaskOutput,
  TaskPrompt,
  TaskStatus
} from '@/schemas/apiSchema'
import { api } from '@/scripts/api'
import { TaskItemImpl, useQueueStore } from '@/stores/queueStore'

// Fixture factories
const createTaskPrompt = (
  queueIndex: number,
  promptId: string,
  inputs: Record<string, any> = {},
  extraData: Record<string, any> = {},
  outputsToExecute: any[] = []
): TaskPrompt => [queueIndex, promptId, inputs, extraData, outputsToExecute]

const createTaskStatus = (
  statusStr: 'success' | 'error' = 'success',
  messages: any[] = []
): TaskStatus => ({
  status_str: statusStr,
  completed: true,
  messages
})

const createTaskOutput = (
  nodeId: string = 'node-1',
  images: any[] = []
): TaskOutput => ({
  [nodeId]: {
    images
  }
})

const createRunningTask = (
  queueIndex: number,
  promptId: string
): RunningTaskItem => ({
  taskType: 'Running',
  prompt: createTaskPrompt(queueIndex, promptId),
  remove: { name: 'Cancel', cb: () => {} }
})

const createPendingTask = (
  queueIndex: number,
  promptId: string
): PendingTaskItem => ({
  taskType: 'Pending',
  prompt: createTaskPrompt(queueIndex, promptId)
})

const createHistoryTask = (
  queueIndex: number,
  promptId: string,
  outputs: TaskOutput = createTaskOutput(),
  status: TaskStatus = createTaskStatus()
): HistoryTaskItem => ({
  taskType: 'History',
  prompt: createTaskPrompt(queueIndex, promptId),
  status,
  outputs
})

// Mock API
vi.mock('@/scripts/api', () => ({
  api: {
    getQueue: vi.fn(),
    getHistory: vi.fn(),
    clearItems: vi.fn(),
    deleteItem: vi.fn(),
    apiURL: vi.fn((path) => `/api${path}`),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }
}))

describe('TaskItemImpl', () => {
  it('should remove animated property from outputs during construction', () => {
    const taskItem = new TaskItemImpl(
      'History',
      [0, 'prompt-id', {}, { client_id: 'client-id' }, []],
      { status_str: 'success', messages: [], completed: true },
      {
        'node-1': {
          images: [{ filename: 'test.png', type: 'output', subfolder: '' }],
          animated: [false]
        }
      }
    )

    // Check that animated property was removed
    expect('animated' in taskItem.outputs['node-1']).toBe(false)

    expect(taskItem.outputs['node-1'].images).toBeDefined()
    expect(taskItem.outputs['node-1'].images?.[0]?.filename).toBe('test.png')
  })

  it('should handle outputs without animated property', () => {
    const taskItem = new TaskItemImpl(
      'History',
      [0, 'prompt-id', {}, { client_id: 'client-id' }, []],
      { status_str: 'success', messages: [], completed: true },
      {
        'node-1': {
          images: [{ filename: 'test.png', type: 'output', subfolder: '' }]
        }
      }
    )

    expect(taskItem.outputs['node-1'].images).toBeDefined()
    expect(taskItem.outputs['node-1'].images?.[0]?.filename).toBe('test.png')
  })

  it('should recognize webm video from core', () => {
    const taskItem = new TaskItemImpl(
      'History',
      [0, 'prompt-id', {}, { client_id: 'client-id' }, []],
      { status_str: 'success', messages: [], completed: true },
      {
        'node-1': {
          video: [{ filename: 'test.webm', type: 'output', subfolder: '' }]
        }
      }
    )

    const output = taskItem.flatOutputs[0]

    expect(output.htmlVideoType).toBe('video/webm')
    expect(output.isVideo).toBe(true)
    expect(output.isWebm).toBe(true)
    expect(output.isVhsFormat).toBe(false)
    expect(output.isImage).toBe(false)
  })

  // https://github.com/Kosinkadink/ComfyUI-VideoHelperSuite/blob/0a75c7958fe320efcb052f1d9f8451fd20c730a8/videohelpersuite/nodes.py#L578-L590
  it('should recognize webm video from VHS', () => {
    const taskItem = new TaskItemImpl(
      'History',
      [0, 'prompt-id', {}, { client_id: 'client-id' }, []],
      { status_str: 'success', messages: [], completed: true },
      {
        'node-1': {
          gifs: [
            {
              filename: 'test.webm',
              type: 'output',
              subfolder: '',
              format: 'video/webm',
              frame_rate: 30
            }
          ]
        }
      }
    )

    const output = taskItem.flatOutputs[0]

    expect(output.htmlVideoType).toBe('video/webm')
    expect(output.isVideo).toBe(true)
    expect(output.isWebm).toBe(true)
    expect(output.isVhsFormat).toBe(true)
    expect(output.isImage).toBe(false)
  })

  it('should recognize mp4 video from core', () => {
    const taskItem = new TaskItemImpl(
      'History',
      [0, 'prompt-id', {}, { client_id: 'client-id' }, []],
      { status_str: 'success', messages: [], completed: true },
      {
        'node-1': {
          images: [
            {
              filename: 'test.mp4',
              type: 'output',
              subfolder: ''
            }
          ],
          animated: [true]
        }
      }
    )

    const output = taskItem.flatOutputs[0]

    expect(output.htmlVideoType).toBe('video/mp4')
    expect(output.isVideo).toBe(true)
    expect(output.isImage).toBe(false)
  })

  describe('audio format detection', () => {
    const audioFormats = [
      { extension: 'mp3', mimeType: 'audio/mpeg' },
      { extension: 'wav', mimeType: 'audio/wav' },
      { extension: 'ogg', mimeType: 'audio/ogg' },
      { extension: 'flac', mimeType: 'audio/flac' }
    ]

    audioFormats.forEach(({ extension, mimeType }) => {
      it(`should recognize ${extension} audio`, () => {
        const taskItem = new TaskItemImpl(
          'History',
          [0, 'prompt-id', {}, { client_id: 'client-id' }, []],
          { status_str: 'success', messages: [], completed: true },
          {
            'node-1': {
              audio: [
                {
                  filename: `test.${extension}`,
                  type: 'output',
                  subfolder: ''
                }
              ]
            }
          }
        )

        const output = taskItem.flatOutputs[0]

        expect(output.htmlAudioType).toBe(mimeType)
        expect(output.isAudio).toBe(true)
        expect(output.isVideo).toBe(false)
        expect(output.isImage).toBe(false)
        expect(output.supportsPreview).toBe(true)
      })
    })
  })
})

describe('useQueueStore', () => {
  let store: ReturnType<typeof useQueueStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useQueueStore()
    vi.clearAllMocks()
  })

  const mockGetQueue = vi.mocked(api.getQueue)
  const mockGetHistory = vi.mocked(api.getHistory)
  const mockClearItems = vi.mocked(api.clearItems)
  const mockDeleteItem = vi.mocked(api.deleteItem)

  describe('initial state', () => {
    it('should have empty state on initialization', () => {
      expect(store.runningTasks).toEqual([])
      expect(store.pendingTasks).toEqual([])
      expect(store.historyTasks).toEqual([])
      expect(store.isLoading).toBe(false)
      expect(store.maxHistoryItems).toBe(64)
    })

    it('should have empty computed tasks', () => {
      expect(store.tasks).toEqual([])
      expect(store.flatTasks).toEqual([])
      expect(store.hasPendingTasks).toBe(false)
      expect(store.lastHistoryQueueIndex).toBe(-1)
    })
  })

  describe('update() - basic functionality', () => {
    it('should load running and pending tasks from API', async () => {
      const runningTask = createRunningTask(1, 'run-1')
      const pendingTask1 = createPendingTask(2, 'pend-1')
      const pendingTask2 = createPendingTask(3, 'pend-2')

      mockGetQueue.mockResolvedValue({
        Running: [runningTask],
        Pending: [pendingTask1, pendingTask2]
      })
      mockGetHistory.mockResolvedValue({ History: [] })

      await store.update()

      expect(store.runningTasks).toHaveLength(1)
      expect(store.pendingTasks).toHaveLength(2)
      expect(store.runningTasks[0].promptId).toBe('run-1')
      expect(store.pendingTasks[0].promptId).toBe('pend-2')
      expect(store.pendingTasks[1].promptId).toBe('pend-1')
    })

    it('should load history tasks from API', async () => {
      const historyTask1 = createHistoryTask(5, 'hist-1')
      const historyTask2 = createHistoryTask(4, 'hist-2')

      mockGetQueue.mockResolvedValue({ Running: [], Pending: [] })
      mockGetHistory.mockResolvedValue({
        History: [historyTask1, historyTask2]
      })

      await store.update()

      expect(store.historyTasks).toHaveLength(2)
      expect(store.historyTasks[0].promptId).toBe('hist-1')
      expect(store.historyTasks[1].promptId).toBe('hist-2')
    })

    it('should set loading state correctly', async () => {
      mockGetQueue.mockResolvedValue({ Running: [], Pending: [] })
      mockGetHistory.mockResolvedValue({ History: [] })

      expect(store.isLoading).toBe(false)

      const updatePromise = store.update()
      expect(store.isLoading).toBe(true)

      await updatePromise
      expect(store.isLoading).toBe(false)
    })

    it('should clear loading state even if API fails', async () => {
      mockGetQueue.mockRejectedValue(new Error('API error'))
      mockGetHistory.mockResolvedValue({ History: [] })

      await expect(store.update()).rejects.toThrow('API error')
      expect(store.isLoading).toBe(false)
    })
  })

  describe('update() - sorting', () => {
    it('should sort tasks by queueIndex descending', async () => {
      const task1 = createHistoryTask(1, 'hist-1')
      const task2 = createHistoryTask(5, 'hist-2')
      const task3 = createHistoryTask(3, 'hist-3')

      mockGetQueue.mockResolvedValue({ Running: [], Pending: [] })
      mockGetHistory.mockResolvedValue({
        History: [task1, task2, task3]
      })

      await store.update()

      expect(store.historyTasks[0].queueIndex).toBe(5)
      expect(store.historyTasks[1].queueIndex).toBe(3)
      expect(store.historyTasks[2].queueIndex).toBe(1)
    })

    it('should sort pending tasks by queueIndex descending', async () => {
      const pend1 = createPendingTask(10, 'pend-1')
      const pend2 = createPendingTask(15, 'pend-2')
      const pend3 = createPendingTask(12, 'pend-3')

      mockGetQueue.mockResolvedValue({
        Running: [],
        Pending: [pend1, pend2, pend3]
      })
      mockGetHistory.mockResolvedValue({ History: [] })

      await store.update()

      expect(store.pendingTasks[0].queueIndex).toBe(15)
      expect(store.pendingTasks[1].queueIndex).toBe(12)
      expect(store.pendingTasks[2].queueIndex).toBe(10)
    })
  })

  describe('update() - queue index collision (THE BUG FIX)', () => {
    it('should NOT confuse different prompts with same queueIndex', async () => {
      const hist1 = createHistoryTask(50, 'prompt-uuid-aaa')

      mockGetQueue.mockResolvedValue({ Running: [], Pending: [] })
      mockGetHistory.mockResolvedValue({ History: [hist1] })

      await store.update()
      expect(store.historyTasks).toHaveLength(1)
      expect(store.historyTasks[0].promptId).toBe('prompt-uuid-aaa')

      const hist2 = createHistoryTask(51, 'prompt-uuid-bbb')
      mockGetHistory.mockResolvedValue({
        History: [hist2]
      })

      await store.update()

      expect(store.historyTasks).toHaveLength(1)
      expect(store.historyTasks[0].promptId).toBe('prompt-uuid-bbb')
      expect(store.historyTasks[0].queueIndex).toBe(51)
    })

    it('should correctly reconcile when queueIndex is reused', async () => {
      const hist1 = createHistoryTask(100, 'first-prompt-at-100')
      const hist2 = createHistoryTask(99, 'prompt-at-99')

      mockGetQueue.mockResolvedValue({ Running: [], Pending: [] })
      mockGetHistory.mockResolvedValue({ History: [hist1, hist2] })

      await store.update()
      expect(store.historyTasks).toHaveLength(2)

      const hist3 = createHistoryTask(101, 'second-prompt-at-101')
      mockGetHistory.mockResolvedValue({
        History: [hist3, hist2]
      })

      await store.update()

      expect(store.historyTasks).toHaveLength(2)
      const promptIds = store.historyTasks.map((t) => t.promptId)
      expect(promptIds).toContain('second-prompt-at-101')
      expect(promptIds).toContain('prompt-at-99')
      expect(promptIds).not.toContain('first-prompt-at-100')
    })

    it('should handle multiple queueIndex collisions simultaneously', async () => {
      const hist1 = createHistoryTask(10, 'old-at-10')
      const hist2 = createHistoryTask(20, 'old-at-20')
      const hist3 = createHistoryTask(30, 'keep-at-30')

      mockGetQueue.mockResolvedValue({ Running: [], Pending: [] })
      mockGetHistory.mockResolvedValue({
        History: [hist3, hist2, hist1]
      })

      await store.update()
      expect(store.historyTasks).toHaveLength(3)

      const newHist1 = createHistoryTask(31, 'new-at-31')
      const newHist2 = createHistoryTask(32, 'new-at-32')
      mockGetHistory.mockResolvedValue({
        History: [newHist2, newHist1, hist3]
      })

      await store.update()

      expect(store.historyTasks).toHaveLength(3)
      const promptIds = store.historyTasks.map((t) => t.promptId)
      expect(promptIds).toEqual(['new-at-32', 'new-at-31', 'keep-at-30'])
    })
  })

  describe('update() - history reconciliation', () => {
    it('should keep existing items still on server (by promptId)', async () => {
      const hist1 = createHistoryTask(10, 'existing-1')
      const hist2 = createHistoryTask(9, 'existing-2')

      mockGetQueue.mockResolvedValue({ Running: [], Pending: [] })
      mockGetHistory.mockResolvedValue({ History: [hist1, hist2] })

      await store.update()
      expect(store.historyTasks).toHaveLength(2)

      const hist3 = createHistoryTask(11, 'new-1')
      mockGetHistory.mockResolvedValue({
        History: [hist3, hist1, hist2]
      })

      await store.update()

      expect(store.historyTasks).toHaveLength(3)
      expect(store.historyTasks.map((t) => t.promptId)).toContain('existing-1')
      expect(store.historyTasks.map((t) => t.promptId)).toContain('existing-2')
      expect(store.historyTasks.map((t) => t.promptId)).toContain('new-1')
    })

    it('should remove items no longer on server', async () => {
      const hist1 = createHistoryTask(10, 'remove-me')
      const hist2 = createHistoryTask(9, 'keep-me')

      mockGetQueue.mockResolvedValue({ Running: [], Pending: [] })
      mockGetHistory.mockResolvedValue({ History: [hist1, hist2] })

      await store.update()
      expect(store.historyTasks).toHaveLength(2)

      mockGetHistory.mockResolvedValue({ History: [hist2] })

      await store.update()

      expect(store.historyTasks).toHaveLength(1)
      expect(store.historyTasks[0].promptId).toBe('keep-me')
    })

    it('should add new items from server', async () => {
      const hist1 = createHistoryTask(5, 'old-1')

      mockGetQueue.mockResolvedValue({ Running: [], Pending: [] })
      mockGetHistory.mockResolvedValue({ History: [hist1] })

      await store.update()

      const hist2 = createHistoryTask(6, 'new-1')
      const hist3 = createHistoryTask(7, 'new-2')
      mockGetHistory.mockResolvedValue({
        History: [hist3, hist2, hist1]
      })

      await store.update()

      expect(store.historyTasks).toHaveLength(3)
      expect(store.historyTasks.map((t) => t.promptId)).toContain('new-1')
      expect(store.historyTasks.map((t) => t.promptId)).toContain('new-2')
    })
  })

  describe('update() - maxHistoryItems limit', () => {
    it('should enforce maxHistoryItems limit', async () => {
      store.maxHistoryItems = 3

      const tasks = Array.from({ length: 5 }, (_, i) =>
        createHistoryTask(10 - i, `hist-${i}`)
      )

      mockGetQueue.mockResolvedValue({ Running: [], Pending: [] })
      mockGetHistory.mockResolvedValue({ History: tasks })

      await store.update()

      expect(store.historyTasks).toHaveLength(3)
      expect(store.historyTasks[0].queueIndex).toBe(10)
      expect(store.historyTasks[1].queueIndex).toBe(9)
      expect(store.historyTasks[2].queueIndex).toBe(8)
    })

    it('should respect maxHistoryItems when combining new and existing', async () => {
      store.maxHistoryItems = 5

      const initial = Array.from({ length: 3 }, (_, i) =>
        createHistoryTask(10 + i, `existing-${i}`)
      )

      mockGetQueue.mockResolvedValue({ Running: [], Pending: [] })
      mockGetHistory.mockResolvedValue({ History: initial })

      await store.update()
      expect(store.historyTasks).toHaveLength(3)

      const newTasks = Array.from({ length: 4 }, (_, i) =>
        createHistoryTask(20 + i, `new-${i}`)
      )
      mockGetHistory.mockResolvedValue({
        History: [...newTasks, ...initial]
      })

      await store.update()

      expect(store.historyTasks).toHaveLength(5)
      expect(store.historyTasks[0].queueIndex).toBe(23)
    })

    it('should handle maxHistoryItems = 0', async () => {
      store.maxHistoryItems = 0

      const tasks = [createHistoryTask(10, 'hist-1')]

      mockGetQueue.mockResolvedValue({ Running: [], Pending: [] })
      mockGetHistory.mockResolvedValue({ History: tasks })

      await store.update()

      expect(store.historyTasks).toHaveLength(0)
    })

    it('should handle maxHistoryItems = 1', async () => {
      store.maxHistoryItems = 1

      const tasks = [
        createHistoryTask(10, 'hist-1'),
        createHistoryTask(9, 'hist-2')
      ]

      mockGetQueue.mockResolvedValue({ Running: [], Pending: [] })
      mockGetHistory.mockResolvedValue({ History: tasks })

      await store.update()

      expect(store.historyTasks).toHaveLength(1)
      expect(store.historyTasks[0].queueIndex).toBe(10)
    })

    it('should dynamically adjust when maxHistoryItems changes', async () => {
      store.maxHistoryItems = 10

      const tasks = Array.from({ length: 15 }, (_, i) =>
        createHistoryTask(20 - i, `hist-${i}`)
      )

      mockGetQueue.mockResolvedValue({ Running: [], Pending: [] })
      mockGetHistory.mockResolvedValue({ History: tasks })

      await store.update()
      expect(store.historyTasks).toHaveLength(10)

      store.maxHistoryItems = 5
      mockGetHistory.mockResolvedValue({ History: tasks })

      await store.update()
      expect(store.historyTasks).toHaveLength(5)
    })
  })

  describe('computed properties', () => {
    it('tasks should combine pending, running, and history in correct order', async () => {
      const running = createRunningTask(5, 'run-1')
      const pending1 = createPendingTask(6, 'pend-1')
      const pending2 = createPendingTask(7, 'pend-2')
      const hist1 = createHistoryTask(3, 'hist-1')
      const hist2 = createHistoryTask(4, 'hist-2')

      mockGetQueue.mockResolvedValue({
        Running: [running],
        Pending: [pending1, pending2]
      })
      mockGetHistory.mockResolvedValue({
        History: [hist2, hist1]
      })

      await store.update()

      expect(store.tasks).toHaveLength(5)
      expect(store.tasks[0].taskType).toBe('Pending')
      expect(store.tasks[1].taskType).toBe('Pending')
      expect(store.tasks[2].taskType).toBe('Running')
      expect(store.tasks[3].taskType).toBe('History')
      expect(store.tasks[4].taskType).toBe('History')
    })

    it('hasPendingTasks should be true when pending tasks exist', async () => {
      mockGetQueue.mockResolvedValue({
        Running: [],
        Pending: [createPendingTask(1, 'pend-1')]
      })
      mockGetHistory.mockResolvedValue({ History: [] })

      await store.update()
      expect(store.hasPendingTasks).toBe(true)
    })

    it('hasPendingTasks should be false when no pending tasks', async () => {
      mockGetQueue.mockResolvedValue({ Running: [], Pending: [] })
      mockGetHistory.mockResolvedValue({ History: [] })

      await store.update()
      expect(store.hasPendingTasks).toBe(false)
    })

    it('lastHistoryQueueIndex should return highest queue index', async () => {
      const hist1 = createHistoryTask(10, 'hist-1')
      const hist2 = createHistoryTask(25, 'hist-2')
      const hist3 = createHistoryTask(15, 'hist-3')

      mockGetQueue.mockResolvedValue({ Running: [], Pending: [] })
      mockGetHistory.mockResolvedValue({
        History: [hist1, hist2, hist3]
      })

      await store.update()
      expect(store.lastHistoryQueueIndex).toBe(25)
    })

    it('lastHistoryQueueIndex should be -1 when no history', async () => {
      mockGetQueue.mockResolvedValue({ Running: [], Pending: [] })
      mockGetHistory.mockResolvedValue({ History: [] })

      await store.update()
      expect(store.lastHistoryQueueIndex).toBe(-1)
    })
  })

  describe('clear()', () => {
    beforeEach(async () => {
      mockGetQueue.mockResolvedValue({
        Running: [createRunningTask(1, 'run-1')],
        Pending: [createPendingTask(2, 'pend-1')]
      })
      mockGetHistory.mockResolvedValue({
        History: [createHistoryTask(3, 'hist-1')]
      })
      await store.update()
    })

    it('should clear both queue and history by default', async () => {
      mockClearItems.mockResolvedValue(undefined)
      mockGetQueue.mockResolvedValue({ Running: [], Pending: [] })
      mockGetHistory.mockResolvedValue({ History: [] })

      await store.clear()

      expect(mockClearItems).toHaveBeenCalledTimes(2)
      expect(mockClearItems).toHaveBeenCalledWith('queue')
      expect(mockClearItems).toHaveBeenCalledWith('history')
      expect(store.runningTasks).toHaveLength(0)
      expect(store.pendingTasks).toHaveLength(0)
      expect(store.historyTasks).toHaveLength(0)
    })

    it('should clear only queue when specified', async () => {
      mockClearItems.mockResolvedValue(undefined)
      mockGetQueue.mockResolvedValue({ Running: [], Pending: [] })
      mockGetHistory.mockResolvedValue({
        History: [createHistoryTask(3, 'hist-1')]
      })

      await store.clear(['queue'])

      expect(mockClearItems).toHaveBeenCalledTimes(1)
      expect(mockClearItems).toHaveBeenCalledWith('queue')
      expect(store.historyTasks).toHaveLength(1)
    })

    it('should clear only history when specified', async () => {
      mockClearItems.mockResolvedValue(undefined)
      mockGetQueue.mockResolvedValue({
        Running: [createRunningTask(1, 'run-1')],
        Pending: [createPendingTask(2, 'pend-1')]
      })
      mockGetHistory.mockResolvedValue({ History: [] })

      await store.clear(['history'])

      expect(mockClearItems).toHaveBeenCalledTimes(1)
      expect(mockClearItems).toHaveBeenCalledWith('history')
      expect(store.runningTasks).toHaveLength(1)
      expect(store.pendingTasks).toHaveLength(1)
    })

    it('should do nothing when empty array passed', async () => {
      await store.clear([])

      expect(mockClearItems).not.toHaveBeenCalled()
    })
  })

  describe('delete()', () => {
    it('should delete task from queue', async () => {
      const task = new TaskItemImpl('Pending', createTaskPrompt(1, 'pend-1'))

      mockDeleteItem.mockResolvedValue(undefined)
      mockGetQueue.mockResolvedValue({ Running: [], Pending: [] })
      mockGetHistory.mockResolvedValue({ History: [] })

      await store.delete(task)

      expect(mockDeleteItem).toHaveBeenCalledWith('queue', 'pend-1')
    })

    it('should delete task from history', async () => {
      const task = new TaskItemImpl(
        'History',
        createTaskPrompt(1, 'hist-1'),
        createTaskStatus(),
        createTaskOutput()
      )

      mockDeleteItem.mockResolvedValue(undefined)
      mockGetQueue.mockResolvedValue({ Running: [], Pending: [] })
      mockGetHistory.mockResolvedValue({ History: [] })

      await store.delete(task)

      expect(mockDeleteItem).toHaveBeenCalledWith('history', 'hist-1')
    })

    it('should refresh store after deletion', async () => {
      const task = new TaskItemImpl('Pending', createTaskPrompt(1, 'pend-1'))

      mockDeleteItem.mockResolvedValue(undefined)
      mockGetQueue.mockResolvedValue({ Running: [], Pending: [] })
      mockGetHistory.mockResolvedValue({ History: [] })

      await store.delete(task)

      expect(mockGetQueue).toHaveBeenCalled()
      expect(mockGetHistory).toHaveBeenCalled()
    })
  })
})
