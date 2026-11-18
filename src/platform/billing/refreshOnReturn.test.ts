import { describe, expect, it, onTestFinished, vi } from 'vitest'

import { registerRefreshOnReturn } from './refreshOnReturn'

describe('registerRefreshOnReturn', () => {
  it('fires on window focus', () => {
    const refresh = vi.fn(async () => {})
    onTestFinished(registerRefreshOnReturn(refresh))

    window.dispatchEvent(new Event('focus'))

    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('fires on a visible visibilitychange', () => {
    const refresh = vi.fn(async () => {})
    onTestFinished(registerRefreshOnReturn(refresh))

    document.dispatchEvent(new Event('visibilitychange'))

    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('ignores a visibilitychange while hidden, then fires once visible', () => {
    const refresh = vi.fn(async () => {})
    const visibilitySpy = vi.spyOn(document, 'visibilityState', 'get')
    visibilitySpy.mockReturnValue('hidden')
    onTestFinished(registerRefreshOnReturn(refresh))

    document.dispatchEvent(new Event('visibilitychange'))
    expect(refresh).not.toHaveBeenCalled()

    visibilitySpy.mockReturnValue('visible')
    document.dispatchEvent(new Event('visibilitychange'))
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  function held() {
    const settles: Array<() => void> = []
    const refresh = vi.fn(
      (_returned: Event) =>
        new Promise<void>((resolve) => {
          settles.push(resolve)
        })
    )
    const settle = async (index: number) => {
      settles[index]()
      await refresh.mock.results[index]?.value
      await Promise.resolve()
    }
    return { refresh, settle }
  }

  const leave = () => window.dispatchEvent(new Event('blur'))
  const come = () => window.dispatchEvent(new Event('focus'))

  it('refreshes again on a later return, so a return before the hosted tab finishes does not spend it', async () => {
    const { refresh, settle } = held()
    onTestFinished(registerRefreshOnReturn(refresh))

    come()
    await settle(0)
    leave()
    come()

    expect(refresh).toHaveBeenCalledTimes(2)
  })

  it('coalesces the focus and visibilitychange of one return into one refresh', async () => {
    const { refresh, settle } = held()
    onTestFinished(registerRefreshOnReturn(refresh))

    come()
    document.dispatchEvent(new Event('visibilitychange'))
    expect(refresh).toHaveBeenCalledTimes(1)
    await settle(0)

    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('runs one trailing refresh for a return that arrives while a refresh is in flight', async () => {
    const { refresh, settle } = held()
    onTestFinished(registerRefreshOnReturn(refresh))

    come()
    leave()
    come()
    expect(refresh).toHaveBeenCalledTimes(1)

    await settle(0)

    expect(refresh).toHaveBeenCalledTimes(2)
  })

  it('hands each refresh the return it answers, the trailing one the return that queued it', async () => {
    const { refresh, settle } = held()
    onTestFinished(registerRefreshOnReturn(refresh))
    const first = new Event('focus')
    const second = new Event('focus')

    window.dispatchEvent(first)
    leave()
    window.dispatchEvent(second)
    await settle(0)

    expect(refresh.mock.calls[0][0]).toBe(first)
    expect(refresh.mock.calls[1][0]).toBe(second)
  })

  it('drops a queued trailing refresh once the returned callback runs', async () => {
    const { refresh, settle } = held()
    const stop = registerRefreshOnReturn(refresh)

    come()
    leave()
    come()
    stop()
    await settle(0)

    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('stops listening once the returned callback runs', () => {
    const refresh = vi.fn(async () => {})
    const stop = registerRefreshOnReturn(refresh)

    stop()
    window.dispatchEvent(new Event('focus'))

    expect(refresh).not.toHaveBeenCalled()
  })
})
