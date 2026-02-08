import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, nextTick, ref } from 'vue'
import type { ComputedRef, Ref } from 'vue'

import type { CompletionSummary } from '@/composables/queue/useCompletionSummary'
import { useCompletionSummary } from '@/composables/queue/useCompletionSummary'
import { useQueueNotificationBanners } from '@/composables/queue/useQueueNotificationBanners'
import { api } from '@/scripts/api'

const mockApi = vi.hoisted(() => new EventTarget())

vi.mock('@/scripts/api', () => ({
  api: mockApi
}))

vi.mock('@/composables/queue/useCompletionSummary', () => ({
  useCompletionSummary: vi.fn()
}))

const mountComposable = () => {
  let composable: ReturnType<typeof useQueueNotificationBanners>
  const wrapper = mount({
    template: '<div />',
    setup() {
      composable = useQueueNotificationBanners()
      return {}
    }
  })
  return { wrapper, composable: composable! }
}

describe('useQueueNotificationBanners', () => {
  let summaryRef: Ref<CompletionSummary | null>
  let summary: ComputedRef<CompletionSummary | null>
  let clearSummarySpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.useFakeTimers()
    summaryRef = ref<CompletionSummary | null>(null)
    summary = computed(() => summaryRef.value)
    clearSummarySpy = vi.fn()
    vi.mocked(useCompletionSummary).mockReturnValue({
      summary,
      clearSummary: clearSummarySpy as unknown as () => void
    })
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
    vi.resetAllMocks()
  })

  it('shows queued notifications from promptQueued events', async () => {
    const { wrapper, composable } = mountComposable()

    try {
      ;(api as unknown as EventTarget).dispatchEvent(
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
      wrapper.unmount()
    }
  })

  it('falls back to 1 when queued batch count is invalid', async () => {
    const { wrapper, composable } = mountComposable()

    try {
      ;(api as unknown as EventTarget).dispatchEvent(
        new CustomEvent('promptQueued', { detail: { batchCount: 0 } })
      )
      await nextTick()

      expect(composable.currentNotification.value).toEqual({
        type: 'queued',
        count: 1
      })
    } finally {
      wrapper.unmount()
    }
  })

  it('shows a completed notification from completion summary', async () => {
    const { wrapper, composable } = mountComposable()

    try {
      summaryRef.value = {
        mode: 'allSuccess',
        completedCount: 2,
        failedCount: 0,
        thumbnailUrls: ['https://example.com/preview.png']
      }
      await nextTick()

      expect(clearSummarySpy).toHaveBeenCalledTimes(1)
      expect(composable.currentNotification.value).toEqual({
        type: 'completed',
        count: 2,
        thumbnailUrl: 'https://example.com/preview.png'
      })
    } finally {
      wrapper.unmount()
    }
  })

  it('queues both completed and failed notifications for mixed summaries', async () => {
    const { wrapper, composable } = mountComposable()

    try {
      summaryRef.value = {
        mode: 'mixed',
        completedCount: 3,
        failedCount: 1,
        thumbnailUrls: ['https://example.com/result.png']
      }
      await nextTick()

      expect(composable.currentNotification.value).toEqual({
        type: 'completed',
        count: 3,
        thumbnailUrl: 'https://example.com/result.png'
      })

      await vi.advanceTimersByTimeAsync(4000)
      await nextTick()

      expect(composable.currentNotification.value).toEqual({
        type: 'failed',
        count: 1
      })
    } finally {
      wrapper.unmount()
    }
  })
})
