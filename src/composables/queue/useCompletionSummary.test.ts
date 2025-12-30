import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, reactive } from 'vue'

import { useCompletionSummary } from '@/composables/queue/useCompletionSummary'
import { useExecutionStore } from '@/stores/executionStore'
import { useQueueStore } from '@/stores/queueStore'

type MockTask = {
  displayStatus: 'Completed' | 'Failed' | 'Cancelled' | 'Running' | 'Pending'
  executionEndTimestamp?: number
  previewOutput?: {
    isImage: boolean
    urlWithTimestamp: string
  }
}

vi.mock('@/stores/queueStore', () => {
  const state = reactive({
    runningTasks: [] as MockTask[],
    historyTasks: [] as MockTask[]
  })

  return {
    useQueueStore: () => state
  }
})

vi.mock('@/stores/executionStore', () => {
  const state = reactive({
    isIdle: true
  })

  return {
    useExecutionStore: () => state
  }
})

describe('useCompletionSummary', () => {
  const queueStore = () =>
    useQueueStore() as {
      runningTasks: MockTask[]
      historyTasks: MockTask[]
    }
  const executionStore = () => useExecutionStore() as { isIdle: boolean }

  const resetState = () => {
    queueStore().runningTasks = []
    queueStore().historyTasks = []
    executionStore().isIdle = true
  }

  const createTask = (
    options: {
      state?: MockTask['displayStatus']
      ts?: number
      previewUrl?: string
      isImage?: boolean
    } = {}
  ): MockTask => {
    const {
      state = 'Completed',
      ts = Date.now(),
      previewUrl,
      isImage = true
    } = options

    const task: MockTask = {
      displayStatus: state,
      executionEndTimestamp: ts
    }

    if (previewUrl) {
      task.previewOutput = {
        isImage,
        urlWithTimestamp: previewUrl
      }
    }

    return task
  }

  const runBatch = async (options: {
    start: number
    finish: number
    tasks: MockTask[]
  }) => {
    const { start, finish, tasks } = options

    vi.setSystemTime(start)
    executionStore().isIdle = false
    await nextTick()

    vi.setSystemTime(finish)
    queueStore().historyTasks = tasks
    executionStore().isIdle = true
    await nextTick()
  }

  beforeEach(() => {
    resetState()
    vi.useFakeTimers()
    vi.setSystemTime(0)
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
    resetState()
  })

  it('summarizes the most recent batch and auto clears after the dismiss delay', async () => {
    const { summary } = useCompletionSummary()
    await nextTick()

    const start = 1_000
    const finish = 2_000

    const tasks = [
      createTask({ ts: start - 100, previewUrl: 'ignored-old' }),
      createTask({ ts: start + 10, previewUrl: 'img-1' }),
      createTask({ ts: start + 20, previewUrl: 'img-2' }),
      createTask({ ts: start + 30, previewUrl: 'img-3' }),
      createTask({ ts: start + 40, previewUrl: 'img-4' }),
      createTask({ state: 'Failed', ts: start + 50 })
    ]

    await runBatch({ start, finish, tasks })

    expect(summary.value).toEqual({
      mode: 'mixed',
      completedCount: 4,
      failedCount: 1,
      thumbnailUrls: ['img-1', 'img-2', 'img-3']
    })

    vi.advanceTimersByTime(6000)
    await nextTick()
    expect(summary.value).toBeNull()
  })

  it('reports allFailed when every task in the batch failed', async () => {
    const { summary } = useCompletionSummary()
    await nextTick()

    const start = 10_000
    const finish = 10_200

    await runBatch({
      start,
      finish,
      tasks: [
        createTask({ state: 'Failed', ts: start + 25 }),
        createTask({ state: 'Failed', ts: start + 50 })
      ]
    })

    expect(summary.value).toEqual({
      mode: 'allFailed',
      completedCount: 0,
      failedCount: 2,
      thumbnailUrls: []
    })
  })

  it('treats cancelled tasks as failures and skips non-image previews', async () => {
    const { summary } = useCompletionSummary()
    await nextTick()

    const start = 15_000
    const finish = 15_200

    await runBatch({
      start,
      finish,
      tasks: [
        createTask({ ts: start + 25, previewUrl: 'img-1' }),
        createTask({
          state: 'Cancelled',
          ts: start + 50,
          previewUrl: 'thumb-ignore',
          isImage: false
        })
      ]
    })

    expect(summary.value).toEqual({
      mode: 'mixed',
      completedCount: 1,
      failedCount: 1,
      thumbnailUrls: ['img-1']
    })
  })

  it('clearSummary dismisses the banner immediately and still tracks future batches', async () => {
    const { summary, clearSummary } = useCompletionSummary()
    await nextTick()

    await runBatch({
      start: 5_000,
      finish: 5_100,
      tasks: [createTask({ ts: 5_050, previewUrl: 'img-1' })]
    })

    expect(summary.value).toEqual({
      mode: 'allSuccess',
      completedCount: 1,
      failedCount: 0,
      thumbnailUrls: ['img-1']
    })

    clearSummary()
    expect(summary.value).toBeNull()

    await runBatch({
      start: 6_000,
      finish: 6_150,
      tasks: [createTask({ ts: 6_075, previewUrl: 'img-2' })]
    })

    expect(summary.value).toEqual({
      mode: 'allSuccess',
      completedCount: 1,
      failedCount: 0,
      thumbnailUrls: ['img-2']
    })
  })

  it('ignores batches that have no finished tasks after the active period started', async () => {
    const { summary } = useCompletionSummary()
    await nextTick()

    const start = 20_000
    const finish = 20_500

    await runBatch({
      start,
      finish,
      tasks: [createTask({ ts: start - 1, previewUrl: 'too-early' })]
    })

    expect(summary.value).toBeNull()
  })

  it('derives the active period from running tasks when execution is already idle', async () => {
    const { summary } = useCompletionSummary()
    await nextTick()

    const start = 25_000
    vi.setSystemTime(start)
    queueStore().runningTasks = [
      createTask({ state: 'Running', ts: start + 1 })
    ]
    await nextTick()

    const finish = start + 150
    vi.setSystemTime(finish)
    queueStore().historyTasks = [
      createTask({ ts: finish - 10, previewUrl: 'img-running-trigger' })
    ]
    queueStore().runningTasks = []
    await nextTick()

    expect(summary.value).toEqual({
      mode: 'allSuccess',
      completedCount: 1,
      failedCount: 0,
      thumbnailUrls: ['img-running-trigger']
    })
  })

  it('does not emit a summary when every finished task is still running or pending', async () => {
    const { summary } = useCompletionSummary()
    await nextTick()

    const start = 30_000
    const finish = 30_300

    await runBatch({
      start,
      finish,
      tasks: [
        createTask({ state: 'Running', ts: start + 20 }),
        createTask({ state: 'Pending', ts: start + 40 })
      ]
    })

    expect(summary.value).toBeNull()
  })
})
