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

  it('keeps polling when a refresh rejects', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    mockFetchBalance.mockRejectedValue(new Error('network'))

    watchForTopupBalanceUpdate()
    returnToApp()
    await vi.advanceTimersByTimeAsync(30_000)

    expect(mockFetchBalance.mock.calls.length).toBeGreaterThan(1)
  })
})
