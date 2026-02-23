import { mount } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import { reactive } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useQueuePolling } from '@/composables/queue/useQueuePolling'

vi.mock('@/stores/queueStore', () => {
  const state = reactive({
    activeJobsCount: 0,
    update: vi.fn()
  })

  return {
    useQueueStore: () => state
  }
})

// Re-import to get the mock instance for assertions
import { useQueueStore } from '@/stores/queueStore'

function mountUseQueuePolling() {
  const wrapper = mount({
    template: '<div />',
    setup() {
      useQueuePolling()
      return {}
    }
  })
  return wrapper
}

describe('useQueuePolling', () => {
  let wrapper: VueWrapper
  const store = useQueueStore() as Partial<
    ReturnType<typeof useQueueStore>
  > as {
    activeJobsCount: number
    update: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    vi.useFakeTimers()
    store.activeJobsCount = 0
    store.update.mockReset()
  })

  afterEach(() => {
    wrapper?.unmount()
    vi.useRealTimers()
  })

  it('calls queueStore.update() immediately on creation', () => {
    wrapper = mountUseQueuePolling()
    expect(store.update).toHaveBeenCalledOnce()
  })

  it('starts polling when activeJobsCount > 0', async () => {
    wrapper = mountUseQueuePolling()
    store.update.mockClear()

    store.activeJobsCount = 2
    await vi.advanceTimersByTimeAsync(5_000)

    expect(store.update).toHaveBeenCalled()
  })

  it('stops polling when activeJobsCount drops to 0', async () => {
    store.activeJobsCount = 1
    wrapper = mountUseQueuePolling()
    store.update.mockClear()

    store.activeJobsCount = 0
    await vi.advanceTimersByTimeAsync(10_000)

    expect(store.update).not.toHaveBeenCalled()
  })

  it('resumes polling when jobs reappear', async () => {
    wrapper = mountUseQueuePolling()
    store.update.mockClear()

    store.activeJobsCount = 1
    await vi.advanceTimersByTimeAsync(5_000)
    expect(store.update).toHaveBeenCalled()

    store.update.mockClear()
    store.activeJobsCount = 0
    await vi.advanceTimersByTimeAsync(5_000)
    expect(store.update).not.toHaveBeenCalled()

    store.update.mockClear()
    store.activeJobsCount = 3
    await vi.advanceTimersByTimeAsync(5_000)
    expect(store.update).toHaveBeenCalled()
  })
})
