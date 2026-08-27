import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { watchForTopupBalanceUpdate } from './topupBalanceRefresh'

const mockFetchBalance = vi.fn()
const mockBalance = {
  value: { amount_micros: 1_000 } as { amount_micros: number } | null
}

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({
    get balance() {
      return mockBalance.value
    },
    fetchBalance: mockFetchBalance
  })
}))

function returnToApp() {
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
  document.dispatchEvent(new Event('visibilitychange'))
}

describe('watchForTopupBalanceUpdate', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
    mockFetchBalance.mockReset()
    mockFetchBalance.mockResolvedValue({ amount_micros: 1_000 })
    mockBalance.value = { amount_micros: 1_000 }
  })

  it('does not refresh until the app tab is visible again', async () => {
    watchForTopupBalanceUpdate()

    await vi.advanceTimersByTimeAsync(30_000)

    expect(mockFetchBalance).not.toHaveBeenCalled()
  })

  it('refreshes the balance when the user returns from checkout', async () => {
    watchForTopupBalanceUpdate()

    returnToApp()
    await vi.advanceTimersByTimeAsync(0)

    expect(mockFetchBalance).toHaveBeenCalledTimes(1)
  })

  it('retries while the balance is unchanged, since the webhook lands late', async () => {
    watchForTopupBalanceUpdate()

    returnToApp()
    await vi.advanceTimersByTimeAsync(30_000)

    expect(mockFetchBalance.mock.calls.length).toBeGreaterThan(1)
  })

  it('stops retrying once the balance increases', async () => {
    mockFetchBalance.mockResolvedValue({ amount_micros: 6_000 })

    watchForTopupBalanceUpdate()
    returnToApp()
    await vi.advanceTimersByTimeAsync(30_000)

    expect(mockFetchBalance).toHaveBeenCalledTimes(1)
  })

  it('stays armed when a bounce back to the app spends the schedule', async () => {
    watchForTopupBalanceUpdate()

    // The user glances at the app before paying: the whole schedule runs
    // against the unchanged balance.
    returnToApp()
    await vi.advanceTimersByTimeAsync(60_000)
    const spentOnBounce = mockFetchBalance.mock.calls.length
    expect(spentOnBounce).toBeGreaterThan(1)

    // The real return, after paying, must still refresh.
    mockFetchBalance.mockResolvedValue({ amount_micros: 6_000 })
    returnToApp()
    await vi.advanceTimersByTimeAsync(0)

    expect(mockFetchBalance.mock.calls.length).toBe(spentOnBounce + 1)
  })

  it('treats the first post-return read as the baseline when none was loaded', async () => {
    mockBalance.value = null

    watchForTopupBalanceUpdate()
    returnToApp()
    await vi.advanceTimersByTimeAsync(60_000)

    // The pre-purchase balance is not the increase we are waiting for, so the
    // schedule must not stop on the first read.
    expect(mockFetchBalance.mock.calls.length).toBeGreaterThan(1)
  })

  it('refreshes when the window regains focus', async () => {
    watchForTopupBalanceUpdate()

    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    window.dispatchEvent(new Event('focus'))
    await vi.advanceTimersByTimeAsync(0)

    expect(mockFetchBalance).toHaveBeenCalledTimes(1)
  })

  it('still refreshes after payment when earlier returns spent the run cap', async () => {
    watchForTopupBalanceUpdate()

    // Five pre-payment glances consume every scheduled run.
    for (let i = 0; i < 5; i++) {
      returnToApp()
      await vi.advanceTimersByTimeAsync(60_000)
    }
    mockFetchBalance.mockClear()
    mockFetchBalance.mockResolvedValue({ amount_micros: 6_000 })

    returnToApp()
    await vi.advanceTimersByTimeAsync(0)

    expect(mockFetchBalance).toHaveBeenCalledTimes(1)
  })

  it('keeps polling when a refresh rejects', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    mockFetchBalance.mockRejectedValue(new Error('network'))

    watchForTopupBalanceUpdate()
    returnToApp()
    await vi.advanceTimersByTimeAsync(30_000)

    expect(mockFetchBalance.mock.calls.length).toBeGreaterThan(1)
  })
})
