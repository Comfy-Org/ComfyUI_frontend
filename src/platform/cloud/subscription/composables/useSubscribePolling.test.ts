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

import { useSubscribePolling } from './useSubscribePolling'

describe('useSubscribePolling', () => {
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

    const { isPending, startPolling } = useSubscribePolling()

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

    const { isPending, isSuccess, isFailed, startPolling } =
      useSubscribePolling({ onSuccess, onError })

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
      useSubscribePolling({ onSuccess, onError })

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

  it('polling times out after max attempts - sets isFailed to true with timeout message', async () => {
    const onError = vi.fn()

    vi.mocked(workspaceApi.getBillingOpStatus).mockResolvedValue({
      id: 'op-1',
      status: 'pending',
      started_at: new Date().toISOString()
    })

    const { isPending, isFailed, errorMessage, startPolling } =
      useSubscribePolling({ onError })

    startPolling('op-1')

    for (let i = 0; i < 100; i++) {
      await vi.advanceTimersByTimeAsync(300)
      await nextTick()
    }

    expect(isPending.value).toBe(false)
    expect(isFailed.value).toBe(true)
    expect(errorMessage.value).toBe('Subscription verification timed out')
    expect(onError).toHaveBeenCalledWith('Subscription verification timed out')
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

    const { stopPolling, startPolling } = useSubscribePolling()

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
      useSubscribePolling({ onError })

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

  it('network errors during polling retry with fixed interval', async () => {
    const onError = vi.fn()

    vi.mocked(workspaceApi.getBillingOpStatus)
      .mockRejectedValueOnce(new Error('Network error'))
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({
        id: 'op-1',
        status: 'succeeded',
        started_at: new Date().toISOString()
      } satisfies BillingOpStatusResponse)

    const { isPending, isSuccess, isFailed, startPolling } =
      useSubscribePolling({ onError })

    startPolling('op-1')

    await vi.advanceTimersByTimeAsync(0)
    await nextTick()
    expect(workspaceApi.getBillingOpStatus).toHaveBeenCalledTimes(1)
    expect(isPending.value).toBe(true)

    await vi.advanceTimersByTimeAsync(300)
    await nextTick()
    expect(workspaceApi.getBillingOpStatus).toHaveBeenCalledTimes(2)
    expect(isPending.value).toBe(true)

    await vi.advanceTimersByTimeAsync(300)
    await nextTick()
    expect(workspaceApi.getBillingOpStatus).toHaveBeenCalledTimes(3)

    expect(isPending.value).toBe(false)
    expect(isSuccess.value).toBe(true)
    expect(isFailed.value).toBe(false)
    expect(onError).not.toHaveBeenCalled()
  })
})
