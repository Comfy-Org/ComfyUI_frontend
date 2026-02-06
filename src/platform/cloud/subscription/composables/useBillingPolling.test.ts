import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import type { BillingOpStatusResponse } from '@/platform/workspace/api/workspaceApi'

vi.mock('@/platform/workspace/api/workspaceApi', () => ({
  workspaceApi: {
    getBillingOpStatus: vi.fn()
  }
}))

vi.mock('vue', async () => {
  const actual = await vi.importActual('vue')
  return {
    ...actual,
    onBeforeUnmount: vi.fn()
  }
})

import { workspaceApi } from '@/platform/workspace/api/workspaceApi'

import { useBillingPolling } from './useBillingPolling'

describe('useBillingPolling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('startPolling sets isPending to true', async () => {
    vi.mocked(workspaceApi.getBillingOpStatus).mockResolvedValue({
      id: 'op-1',
      status: 'pending',
      started_at: new Date().toISOString()
    })

    const { isPending, startPolling } = useBillingPolling()

    expect(isPending.value).toBe(false)
    startPolling('op-1')
    expect(isPending.value).toBe(true)
  })

  it('polling succeeds - calls onSuccess, sets isSuccess to true, clears isPending', async () => {
    const onSuccess = vi.fn()
    const onError = vi.fn()

    vi.mocked(workspaceApi.getBillingOpStatus).mockResolvedValue({
      id: 'op-1',
      status: 'succeeded',
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString()
    })

    const { isPending, isSuccess, isFailed, startPolling } = useBillingPolling({
      onSuccess,
      onError
    })

    startPolling('op-1')
    await vi.advanceTimersByTimeAsync(0)
    await nextTick()

    expect(isPending.value).toBe(false)
    expect(isSuccess.value).toBe(true)
    expect(isFailed.value).toBe(false)
    expect(onSuccess).toHaveBeenCalledOnce()
    expect(onError).not.toHaveBeenCalled()
  })

  it('polling fails - calls onError with error message, sets isFailed to true, sets errorMessage', async () => {
    const onSuccess = vi.fn()
    const onError = vi.fn()
    const errorMsg = 'Payment declined'

    vi.mocked(workspaceApi.getBillingOpStatus).mockResolvedValue({
      id: 'op-1',
      status: 'failed',
      error_message: errorMsg,
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString()
    })

    const { isPending, isSuccess, isFailed, errorMessage, startPolling } =
      useBillingPolling({ onSuccess, onError })

    startPolling('op-1')
    await vi.advanceTimersByTimeAsync(0)
    await nextTick()

    expect(isPending.value).toBe(false)
    expect(isSuccess.value).toBe(false)
    expect(isFailed.value).toBe(true)
    expect(errorMessage.value).toBe(errorMsg)
    expect(onError).toHaveBeenCalledWith(errorMsg)
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('uses custom failedMessage when no error_message in response', async () => {
    const onError = vi.fn()

    vi.mocked(workspaceApi.getBillingOpStatus).mockResolvedValue({
      id: 'op-1',
      status: 'failed',
      started_at: new Date().toISOString()
    })

    const { errorMessage, startPolling } = useBillingPolling({
      onError,
      failedMessage: 'Custom failure message'
    })

    startPolling('op-1')
    await vi.advanceTimersByTimeAsync(0)
    await nextTick()

    expect(errorMessage.value).toBe('Custom failure message')
    expect(onError).toHaveBeenCalledWith('Custom failure message')
  })

  it('polling times out after 2 minutes - sets isFailed and isTimeout to true', async () => {
    const onError = vi.fn()

    vi.mocked(workspaceApi.getBillingOpStatus).mockResolvedValue({
      id: 'op-1',
      status: 'pending',
      started_at: new Date().toISOString()
    })

    const { isPending, isFailed, isTimeout, errorMessage, startPolling } =
      useBillingPolling({
        onError,
        timeoutMessage: 'Operation timed out'
      })

    startPolling('op-1')

    // First poll is immediate
    await vi.advanceTimersByTimeAsync(0)
    await nextTick()

    // Advance past the 2-minute timeout
    await vi.advanceTimersByTimeAsync(120_001)
    // Run all pending async work
    await vi.runAllTimersAsync()
    await nextTick()

    expect(isPending.value).toBe(false)
    expect(isFailed.value).toBe(true)
    expect(isTimeout.value).toBe(true)
    expect(errorMessage.value).toBe('Operation timed out')
    expect(onError).toHaveBeenCalledWith('Operation timed out')
  })

  it('uses exponential backoff for polling intervals', async () => {
    vi.mocked(workspaceApi.getBillingOpStatus).mockResolvedValue({
      id: 'op-1',
      status: 'pending',
      started_at: new Date().toISOString()
    })

    const { startPolling } = useBillingPolling()

    startPolling('op-1')

    // First call is immediate
    await vi.advanceTimersByTimeAsync(0)
    await nextTick()
    expect(workspaceApi.getBillingOpStatus).toHaveBeenCalledTimes(1)

    // Next call after 1000ms * 1.5 = 1500ms
    await vi.advanceTimersByTimeAsync(1500)
    await nextTick()
    expect(workspaceApi.getBillingOpStatus).toHaveBeenCalledTimes(2)

    // Next call after 1500ms * 1.5 = 2250ms
    await vi.advanceTimersByTimeAsync(2250)
    await nextTick()
    expect(workspaceApi.getBillingOpStatus).toHaveBeenCalledTimes(3)

    // Next call after 2250ms * 1.5 = 3375ms
    await vi.advanceTimersByTimeAsync(3375)
    await nextTick()
    expect(workspaceApi.getBillingOpStatus).toHaveBeenCalledTimes(4)
  })

  it('caps polling interval at 8 seconds', async () => {
    vi.mocked(workspaceApi.getBillingOpStatus).mockResolvedValue({
      id: 'op-1',
      status: 'pending',
      started_at: new Date().toISOString()
    })

    const { startPolling } = useBillingPolling()

    startPolling('op-1')

    // Skip ahead past where backoff would exceed 8s
    // After several iterations the interval caps at 8000ms
    await vi.advanceTimersByTimeAsync(60_000)
    await nextTick()

    const callCount = vi.mocked(workspaceApi.getBillingOpStatus).mock.calls
      .length

    // Advance another 8 seconds - should get exactly one more call
    await vi.advanceTimersByTimeAsync(8000)
    await nextTick()

    expect(
      vi.mocked(workspaceApi.getBillingOpStatus).mock.calls.length
    ).toBeGreaterThan(callCount)
  })

  it('stopPolling clears the timeout', async () => {
    let callCount = 0
    vi.mocked(workspaceApi.getBillingOpStatus).mockImplementation(async () => {
      callCount++
      return {
        id: 'op-1',
        status: 'pending',
        started_at: new Date().toISOString()
      }
    })

    const { stopPolling, startPolling } = useBillingPolling()

    startPolling('op-1')
    await vi.advanceTimersByTimeAsync(0)
    await nextTick()

    expect(callCount).toBe(1)

    stopPolling()

    await vi.advanceTimersByTimeAsync(60000)
    await nextTick()

    expect(callCount).toBe(1)
  })

  it('calling startPolling again resets all state', async () => {
    const onError = vi.fn()

    vi.mocked(workspaceApi.getBillingOpStatus).mockResolvedValueOnce({
      id: 'op-1',
      status: 'failed',
      error_message: 'First error',
      started_at: new Date().toISOString()
    })

    const { isPending, isSuccess, isFailed, errorMessage, startPolling } =
      useBillingPolling({ onError })

    startPolling('op-1')
    await vi.advanceTimersByTimeAsync(0)
    await nextTick()

    expect(isFailed.value).toBe(true)
    expect(errorMessage.value).toBe('First error')

    vi.mocked(workspaceApi.getBillingOpStatus).mockResolvedValueOnce({
      id: 'op-2',
      status: 'succeeded',
      started_at: new Date().toISOString()
    })

    startPolling('op-2')

    expect(isPending.value).toBe(true)
    expect(isSuccess.value).toBe(false)
    expect(isFailed.value).toBe(false)
    expect(errorMessage.value).toBe(null)

    await vi.advanceTimersByTimeAsync(0)
    await nextTick()

    expect(isSuccess.value).toBe(true)
    expect(isPending.value).toBe(false)
  })

  it('network errors during polling continue with backoff', async () => {
    const onError = vi.fn()

    vi.mocked(workspaceApi.getBillingOpStatus)
      .mockRejectedValueOnce(new Error('Network error'))
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({
        id: 'op-1',
        status: 'succeeded',
        started_at: new Date().toISOString()
      } satisfies BillingOpStatusResponse)

    const { isPending, isSuccess, isFailed, startPolling } = useBillingPolling({
      onError
    })

    startPolling('op-1')

    // First call (immediate)
    await vi.advanceTimersByTimeAsync(0)
    await nextTick()
    expect(workspaceApi.getBillingOpStatus).toHaveBeenCalledTimes(1)
    expect(isPending.value).toBe(true)

    // Second call after backoff (1500ms)
    await vi.advanceTimersByTimeAsync(1500)
    await nextTick()
    expect(workspaceApi.getBillingOpStatus).toHaveBeenCalledTimes(2)
    expect(isPending.value).toBe(true)

    // Third call after backoff (2250ms)
    await vi.advanceTimersByTimeAsync(2250)
    await nextTick()
    expect(workspaceApi.getBillingOpStatus).toHaveBeenCalledTimes(3)

    expect(isPending.value).toBe(false)
    expect(isSuccess.value).toBe(true)
    expect(isFailed.value).toBe(false)
    expect(onError).not.toHaveBeenCalled()
  })
})
