import { mount } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import { ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useQueuePolling } from '@/composables/queue/useQueuePolling'

const activeJobsCountRef = ref(0)
const updateMock = vi.fn()

vi.mock('@/stores/queueStore', () => ({
  useQueueStore: () => ({
    get activeJobsCount() {
      return activeJobsCountRef.value
    },
    update: updateMock
  })
}))

const mountedWrappers: VueWrapper[] = []

function mountUseQueuePolling() {
  const wrapper = mount({
    template: '<div />',
    setup() {
      useQueuePolling()
      return {}
    }
  })
  mountedWrappers.push(wrapper)
  return wrapper
}

describe('useQueuePolling', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    activeJobsCountRef.value = 0
    updateMock.mockReset()
  })

  afterEach(() => {
    mountedWrappers.forEach((w) => w.unmount())
    mountedWrappers.length = 0
    vi.useRealTimers()
  })

  it('calls queueStore.update() immediately on creation', () => {
    mountUseQueuePolling()
    expect(updateMock).toHaveBeenCalledOnce()
  })

  it('starts polling when activeJobsCount > 0', async () => {
    mountUseQueuePolling()
    updateMock.mockClear()

    activeJobsCountRef.value = 2
    await vi.advanceTimersByTimeAsync(5_000)

    expect(updateMock).toHaveBeenCalled()
  })

  it('stops polling when activeJobsCount drops to 0', async () => {
    activeJobsCountRef.value = 1
    mountUseQueuePolling()
    updateMock.mockClear()

    activeJobsCountRef.value = 0
    await vi.advanceTimersByTimeAsync(10_000)

    expect(updateMock).not.toHaveBeenCalled()
  })

  it('resumes polling when jobs reappear', async () => {
    mountUseQueuePolling()
    updateMock.mockClear()

    activeJobsCountRef.value = 1
    await vi.advanceTimersByTimeAsync(5_000)
    expect(updateMock).toHaveBeenCalled()

    updateMock.mockClear()
    activeJobsCountRef.value = 0
    await vi.advanceTimersByTimeAsync(5_000)
    expect(updateMock).not.toHaveBeenCalled()

    updateMock.mockClear()
    activeJobsCountRef.value = 3
    await vi.advanceTimersByTimeAsync(5_000)
    expect(updateMock).toHaveBeenCalled()
  })
})
