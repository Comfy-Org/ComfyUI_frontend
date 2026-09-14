import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/stores/authStore'

import { watchForTopupBalanceUpdate } from './topupBalanceRefresh'

vi.mock(import('firebase/auth'))

function returnToApp() {
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
  document.dispatchEvent(new Event('visibilitychange'))
}

describe('watchForTopupBalanceUpdate', () => {
  beforeEach(() => {
    const store = useAuthStore()
    vi.useFakeTimers()
    vi.mocked(store.fetchBalance).mockResolvedValue({
      currency: 'usd',
      amount_micros: 1_000
    })
    store.balance = { currency: 'usd', amount_micros: 1_000 }
  })

  it('does not refresh until the app tab is visible again', async () => {
    watchForTopupBalanceUpdate()

    await vi.advanceTimersByTimeAsync(30_000)

    expect(useAuthStore().fetchBalance).not.toHaveBeenCalled()
  })

  it('refreshes the balance when the user returns from checkout', async () => {
    watchForTopupBalanceUpdate()

    returnToApp()
    await vi.advanceTimersByTimeAsync(0)

    expect(useAuthStore().fetchBalance).toHaveBeenCalledTimes(1)
  })

  it('retries while the balance is unchanged, since the webhook lands late', async () => {
    watchForTopupBalanceUpdate()

    returnToApp()
    await vi.advanceTimersByTimeAsync(30_000)

    expect(
      vi.mocked(useAuthStore().fetchBalance).mock.calls.length
    ).toBeGreaterThan(1)
  })

  it('stops retrying once the balance increases', async () => {
    vi.mocked(useAuthStore().fetchBalance).mockResolvedValue({
      currency: 'usd',
      amount_micros: 6_000
    })

    watchForTopupBalanceUpdate()
    returnToApp()
    await vi.advanceTimersByTimeAsync(30_000)

    expect(useAuthStore().fetchBalance).toHaveBeenCalledTimes(1)
  })

  it('stays armed when a bounce back to the app spends the schedule', async () => {
    watchForTopupBalanceUpdate()

    // The user glances at the app before paying: the whole schedule runs
    // against the unchanged balance.
    returnToApp()
    await vi.advanceTimersByTimeAsync(60_000)
    const spentOnBounce = vi.mocked(useAuthStore().fetchBalance).mock.calls
      .length
    expect(spentOnBounce).toBeGreaterThan(1)

    // The real return, after paying, must still refresh.
    vi.mocked(useAuthStore().fetchBalance).mockResolvedValue({
      currency: 'usd',
      amount_micros: 6_000
    })
    returnToApp()
    await vi.advanceTimersByTimeAsync(0)

    expect(vi.mocked(useAuthStore().fetchBalance).mock.calls.length).toBe(
      spentOnBounce + 1
    )
  })

  it('treats the first post-return read as the baseline when none was loaded', async () => {
    useAuthStore().balance = null

    watchForTopupBalanceUpdate()
    returnToApp()
    await vi.advanceTimersByTimeAsync(60_000)

    // The pre-purchase balance is not the increase we are waiting for, so the
    // schedule must not stop on the first read.
    expect(
      vi.mocked(useAuthStore().fetchBalance).mock.calls.length
    ).toBeGreaterThan(1)
  })

  it('refreshes when the window regains focus', async () => {
    watchForTopupBalanceUpdate()

    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    window.dispatchEvent(new Event('focus'))
    await vi.advanceTimersByTimeAsync(0)

    expect(useAuthStore().fetchBalance).toHaveBeenCalledTimes(1)
  })

  it('still refreshes after payment when earlier returns spent the run cap', async () => {
    watchForTopupBalanceUpdate()

    // Five pre-payment glances consume every scheduled run.
    for (let i = 0; i < 5; i++) {
      returnToApp()
      await vi.advanceTimersByTimeAsync(60_000)
    }
    vi.mocked(useAuthStore().fetchBalance).mockClear()
    vi.mocked(useAuthStore().fetchBalance).mockResolvedValue({
      currency: 'usd',
      amount_micros: 6_000
    })

    returnToApp()
    await vi.advanceTimersByTimeAsync(0)

    expect(useAuthStore().fetchBalance).toHaveBeenCalledTimes(1)
  })

  it('keeps polling when a refresh rejects', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.mocked(useAuthStore().fetchBalance).mockRejectedValue(
      new Error('network')
    )

    watchForTopupBalanceUpdate()
    returnToApp()
    await vi.advanceTimersByTimeAsync(30_000)

    expect(
      vi.mocked(useAuthStore().fetchBalance).mock.calls.length
    ).toBeGreaterThan(1)
  })
})
