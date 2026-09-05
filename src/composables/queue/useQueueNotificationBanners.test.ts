import { render } from '@testing-library/vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, reactive } from 'vue'

import { useQueueNotificationBanners } from '@/composables/queue/useQueueNotificationBanners'
import { useExecutionStore } from '@/stores/executionStore'
import { useQueueStore } from '@/stores/queueStore'

const mockApi = vi.hoisted(() => new EventTarget())

vi.mock('@/scripts/api', () => ({
  api: mockApi
}))

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
    pendingTasks: [] as MockTask[],
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

const mountComposable = () => {
  let composable: ReturnType<typeof useQueueNotificationBanners>
  const result = render({
    template: '<div />',
    setup() {
      composable = useQueueNotificationBanners()
      return {}
    }
  })
  return { ...result, composable: composable! }
}

describe(useQueueNotificationBanners, () => {
  const queueStore = () =>
    useQueueStore() as {
      pendingTasks: MockTask[]
      runningTasks: MockTask[]
      historyTasks: MockTask[]
    }
  const executionStore = () => useExecutionStore() as { isIdle: boolean }

  const resetState = () => {
    queueStore().pendingTasks = []
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
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    resetState()
  })

  it('shows queued notifications from promptQueued events', async () => {
    const { unmount, composable } = mountComposable()

    try {
      mockApi.dispatchEvent(
        new CustomEvent('promptQueued', { detail: { batchCount: 4 } })
      )
      await nextTick()

      expect(composable.currentNotification.value).toEqual({
        type: 'queued',
        count: 4
      })

      await vi.advanceTimersByTimeAsync(4000)
      await nextTick()
      expect(composable.currentNotification.value).toBeNull()
    } finally {
      unmount()
    }
  })

  it('shows queued pending then queued confirmation', async () => {
    const { unmount, composable } = mountComposable()

    try {
      mockApi.dispatchEvent(
        new CustomEvent('promptQueueing', {
          detail: { requestId: 1, batchCount: 2 }
        })
      )
      await nextTick()

      expect(composable.currentNotification.value).toEqual({
        type: 'queuedPending',
        count: 2,
        requestId: 1
      })

      mockApi.dispatchEvent(
        new CustomEvent('promptQueued', {
          detail: { requestId: 1, batchCount: 2 }
        })
      )
      await nextTick()

      expect(composable.currentNotification.value).toEqual({
        type: 'queued',
        count: 2,
        requestId: 1
      })
    } finally {
      unmount()
    }
  })

  it('falls back to 1 when queued batch count is invalid', async () => {
    const { unmount, composable } = mountComposable()

    try {
      mockApi.dispatchEvent(
        new CustomEvent('promptQueued', { detail: { batchCount: 0 } })
      )
      await nextTick()

      expect(composable.currentNotification.value).toEqual({
        type: 'queued',
        count: 1
      })
    } finally {
      unmount()
    }
  })

  it('shows a completed notification from a finished batch', async () => {
    const { unmount, composable } = mountComposable()
    const now = Date.now()

    try {
      await runBatch({
        start: now + 1_000,
        finish: now + 1_200,
        tasks: [
          createTask({
            ts: now + 1_050,
            previewUrl: 'https://example.com/preview.png'
          })
        ]
      })

      expect(composable.currentNotification.value).toEqual({
        type: 'completed',
        count: 1,
        thumbnailUrls: ['https://example.com/preview.png']
      })
    } finally {
      unmount()
    }
  })

  it('shows one completion notification when history updates after queue becomes idle', async () => {
    const { unmount, composable } = mountComposable()
    const now = Date.now()

    try {
      vi.setSystemTime(now + 4_000)
      executionStore().isIdle = false
      await nextTick()

      vi.setSystemTime(now + 4_100)
      executionStore().isIdle = true
      queueStore().historyTasks = []
      await nextTick()

      expect(composable.currentNotification.value).toBeNull()

      queueStore().historyTasks = [
        createTask({
          ts: now + 4_050,
          previewUrl: 'https://example.com/race-preview.png'
        })
      ]
      await nextTick()

      expect(composable.currentNotification.value).toEqual({
        type: 'completed',
        count: 1,
        thumbnailUrls: ['https://example.com/race-preview.png']
      })

      await vi.advanceTimersByTimeAsync(4000)
      await nextTick()
      expect(composable.currentNotification.value).toBeNull()

      await vi.advanceTimersByTimeAsync(4000)
      await nextTick()
      expect(composable.currentNotification.value).toBeNull()
    } finally {
      unmount()
    }
  })

  it('queues both completed and failed notifications for mixed batches', async () => {
    const { unmount, composable } = mountComposable()
    const now = Date.now()

    try {
      await runBatch({
        start: now + 2_000,
        finish: now + 2_200,
        tasks: [
          createTask({
            ts: now + 2_050,
            previewUrl: 'https://example.com/result.png'
          }),
          createTask({ ts: now + 2_060 }),
          createTask({ ts: now + 2_070 }),
          createTask({ state: 'Failed', ts: now + 2_080 })
        ]
      })

      expect(composable.currentNotification.value).toEqual({
        type: 'completed',
        count: 3,
        thumbnailUrls: ['https://example.com/result.png']
      })

      await vi.advanceTimersByTimeAsync(4000)
      await nextTick()

      expect(composable.currentNotification.value).toEqual({
        type: 'failed',
        count: 1
      })
    } finally {
      unmount()
    }
  })

  it('uses up to two completion thumbnails for notification icon previews', async () => {
    const { unmount, composable } = mountComposable()
    const now = Date.now()

    try {
      await runBatch({
        start: now + 3_000,
        finish: now + 3_300,
        tasks: [
          createTask({
            ts: now + 3_050,
            previewUrl: 'https://example.com/preview-1.png'
          }),
          createTask({
            ts: now + 3_060,
            previewUrl: 'https://example.com/preview-2.png'
          }),
          createTask({
            ts: now + 3_070,
            previewUrl: 'https://example.com/preview-3.png'
          }),
          createTask({
            ts: now + 3_080,
            previewUrl: 'https://example.com/preview-4.png'
          })
        ]
      })

      expect(composable.currentNotification.value).toEqual({
        type: 'completed',
        count: 4,
        thumbnailUrls: [
          'https://example.com/preview-1.png',
          'https://example.com/preview-2.png'
        ]
      })
    } finally {
      unmount()
    }
  })

  it('acknowledges a new run over an outcome notification still on screen', async () => {
    const { unmount, composable } = mountComposable()

    try {
      await runBatch({
        start: 5_000,
        finish: 5_100,
        tasks: [createTask({ state: 'Failed', ts: 5_050 })]
      })

      expect(composable.currentNotification.value).toEqual({
        type: 'failed',
        count: 1
      })

      mockApi.dispatchEvent(
        new CustomEvent('promptQueueing', {
          detail: { requestId: 7, batchCount: 1 }
        })
      )
      await nextTick()

      expect(composable.currentNotification.value).toEqual({
        type: 'queuedPending',
        count: 1,
        requestId: 7
      })
    } finally {
      unmount()
    }
  })

  it('acknowledges a new run ahead of outcome notifications still waiting', async () => {
    const { unmount, composable } = mountComposable()

    try {
      await runBatch({
        start: 6_000,
        finish: 6_100,
        tasks: [
          createTask({ ts: 6_050 }),
          createTask({ state: 'Failed', ts: 6_060 })
        ]
      })

      expect(composable.currentNotification.value).toEqual({
        type: 'completed',
        count: 1,
        thumbnailUrls: []
      })

      mockApi.dispatchEvent(
        new CustomEvent('promptQueueing', {
          detail: { requestId: 8, batchCount: 1 }
        })
      )
      await nextTick()

      expect(composable.currentNotification.value).toEqual({
        type: 'queuedPending',
        count: 1,
        requestId: 8
      })

      await vi.advanceTimersByTimeAsync(4000)
      await nextTick()

      expect(composable.currentNotification.value).toEqual({
        type: 'failed',
        count: 1
      })
    } finally {
      unmount()
    }
  })

  it('keeps a later run ahead of outcomes while an acknowledgement shows', async () => {
    const { unmount, composable } = mountComposable()

    try {
      await runBatch({
        start: 7_000,
        finish: 7_100,
        tasks: [
          createTask({ ts: 7_050 }),
          createTask({ state: 'Failed', ts: 7_060 })
        ]
      })

      mockApi.dispatchEvent(
        new CustomEvent('promptQueueing', {
          detail: { requestId: 9, batchCount: 1 }
        })
      )
      await nextTick()

      expect(composable.currentNotification.value).toEqual({
        type: 'queuedPending',
        count: 1,
        requestId: 9
      })

      mockApi.dispatchEvent(
        new CustomEvent('promptQueueing', {
          detail: { requestId: 10, batchCount: 1 }
        })
      )
      await nextTick()

      await vi.advanceTimersByTimeAsync(4000)
      await nextTick()

      expect(composable.currentNotification.value).toEqual({
        type: 'queuedPending',
        count: 1,
        requestId: 10
      })

      await vi.advanceTimersByTimeAsync(4000)
      await nextTick()

      expect(composable.currentNotification.value).toEqual({
        type: 'failed',
        count: 1
      })
    } finally {
      unmount()
    }
  })
})
