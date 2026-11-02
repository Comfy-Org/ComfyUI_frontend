import { beforeEach, describe, expect, it, vi } from 'vitest'

import { watchForTopupBalanceUpdate } from './topupBalanceRefresh'

function returnToApp() {
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
  document.dispatchEvent(new Event('visibilitychange'))
}

describe('watchForTopupBalanceUpdate', () => {
  let loadedMicros: number | null
  const fetchBalance = vi.fn<() => Promise<number | null>>()
  const source = { current: () => loadedMicros, fetch: fetchBalance }

  beforeEach(() => {
    vi.useFakeTimers()
    loadedMicros = 1_000
    fetchBalance.mockReset()
    fetchBalance.mockResolvedValue(1_000)
  })

  it('does not refresh until the app tab is visible again', async () => {
    watchForTopupBalanceUpdate({ source })

    await vi.advanceTimersByTimeAsync(30_000)

    expect(fetchBalance).not.toHaveBeenCalled()
  })

  it('refreshes the balance when the user returns from checkout', async () => {
    watchForTopupBalanceUpdate({ source })

    returnToApp()
    await vi.advanceTimersByTimeAsync(0)

    expect(fetchBalance).toHaveBeenCalledTimes(1)
  })

  it('retries while the balance is unchanged, since the webhook lands late', async () => {
    watchForTopupBalanceUpdate({ source })

    returnToApp()
    await vi.advanceTimersByTimeAsync(30_000)

    expect(fetchBalance.mock.calls.length).toBeGreaterThan(1)
  })

  it('stops retrying once the balance increases', async () => {
    fetchBalance.mockResolvedValue(6_000)

    watchForTopupBalanceUpdate({ source })
    returnToApp()
    await vi.advanceTimersByTimeAsync(30_000)

    expect(fetchBalance).toHaveBeenCalledTimes(1)
  })

  it('stays armed when a bounce back to the app spends the schedule', async () => {
    watchForTopupBalanceUpdate({ source })

    // The user glances at the app before paying: the whole schedule runs
    // against the unchanged balance.
    returnToApp()
    await vi.advanceTimersByTimeAsync(60_000)
    const spentOnBounce = fetchBalance.mock.calls.length
    expect(spentOnBounce).toBeGreaterThan(1)

    // The real return, after paying, must still refresh.
    fetchBalance.mockResolvedValue(6_000)
    returnToApp()
    await vi.advanceTimersByTimeAsync(0)

    expect(fetchBalance.mock.calls.length).toBe(spentOnBounce + 1)
  })

  it('treats the first post-return read as the baseline when none was loaded', async () => {
    loadedMicros = null

    watchForTopupBalanceUpdate({ source })
    returnToApp()
    await vi.advanceTimersByTimeAsync(60_000)

    // The pre-purchase balance is not the increase we are waiting for, so the
    // schedule must not stop on the first read.
    expect(fetchBalance.mock.calls.length).toBeGreaterThan(1)
  })

  it('refreshes when the window regains focus', async () => {
    watchForTopupBalanceUpdate({ source })

    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    window.dispatchEvent(new Event('focus'))
    await vi.advanceTimersByTimeAsync(0)

    expect(fetchBalance).toHaveBeenCalledTimes(1)
  })

  it('still refreshes after payment when earlier returns spent the run cap', async () => {
    watchForTopupBalanceUpdate({ source })

    // Five pre-payment glances consume every scheduled run.
    for (let i = 0; i < 5; i++) {
      returnToApp()
      await vi.advanceTimersByTimeAsync(60_000)
    }
    fetchBalance.mockClear()
    fetchBalance.mockResolvedValue(6_000)

    returnToApp()
    await vi.advanceTimersByTimeAsync(0)

    expect(fetchBalance).toHaveBeenCalledTimes(1)
  })

  it('keeps polling when a refresh rejects', async () => {
    fetchBalance.mockRejectedValue(new Error('network'))

    watchForTopupBalanceUpdate({ source })
    returnToApp()
    await vi.advanceTimersByTimeAsync(30_000)

    expect(fetchBalance.mock.calls.length).toBeGreaterThan(1)
  })

  it('refreshes dependents once when the balance rises', async () => {
    const onBalanceIncreased = vi.fn(async () => {})
    fetchBalance.mockResolvedValue(6_000)

    watchForTopupBalanceUpdate({ source, onBalanceIncreased })
    returnToApp()
    await vi.advanceTimersByTimeAsync(30_000)

    expect(onBalanceIncreased).toHaveBeenCalledOnce()
  })

  it('leaves dependents alone while the balance is unchanged', async () => {
    const onBalanceIncreased = vi.fn(async () => {})

    watchForTopupBalanceUpdate({ source, onBalanceIncreased })
    returnToApp()
    await vi.advanceTimersByTimeAsync(30_000)

    expect(onBalanceIncreased).not.toHaveBeenCalled()
  })

  it('stops the watch even when the dependent refresh rejects', async () => {
    fetchBalance.mockResolvedValue(6_000)

    watchForTopupBalanceUpdate({
      source,
      onBalanceIncreased: () => Promise.reject(new Error('status down'))
    })
    returnToApp()
    await vi.advanceTimersByTimeAsync(30_000)

    expect(fetchBalance).toHaveBeenCalledTimes(1)
    expect(console.warn).toHaveBeenCalled()
  })
})
