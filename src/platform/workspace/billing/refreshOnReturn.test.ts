import { describe, expect, it, vi } from 'vitest'

import { registerRefreshOnReturn } from './refreshOnReturn'

describe('registerRefreshOnReturn', () => {
  it('fires on window focus', () => {
    const refresh = vi.fn(async () => {})
    registerRefreshOnReturn(refresh)

    window.dispatchEvent(new Event('focus'))

    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('fires on a visible visibilitychange', () => {
    const refresh = vi.fn(async () => {})
    registerRefreshOnReturn(refresh)

    document.dispatchEvent(new Event('visibilitychange'))

    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('ignores a visibilitychange while hidden, then fires once visible', () => {
    const refresh = vi.fn(async () => {})
    const visibilitySpy = vi.spyOn(document, 'visibilityState', 'get')
    visibilitySpy.mockReturnValue('hidden')
    registerRefreshOnReturn(refresh)

    document.dispatchEvent(new Event('visibilitychange'))
    expect(refresh).not.toHaveBeenCalled()

    visibilitySpy.mockReturnValue('visible')
    document.dispatchEvent(new Event('visibilitychange'))
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('refreshes again on a later return, so a return before the hosted tab finishes does not spend it', async () => {
    const refresh = vi.fn(async () => {})
    registerRefreshOnReturn(refresh)

    window.dispatchEvent(new Event('focus'))
    await refresh.mock.results[0]?.value
    await Promise.resolve()
    window.dispatchEvent(new Event('focus'))

    expect(refresh).toHaveBeenCalledTimes(2)
  })

  it('coalesces the focus and visibilitychange of one return into one refresh', async () => {
    let settle!: () => void
    const refresh = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          settle = resolve
        })
    )
    registerRefreshOnReturn(refresh)

    window.dispatchEvent(new Event('focus'))
    document.dispatchEvent(new Event('visibilitychange'))
    expect(refresh).toHaveBeenCalledTimes(1)

    settle()
    await refresh.mock.results[0]?.value
    await Promise.resolve()
    window.dispatchEvent(new Event('focus'))

    expect(refresh).toHaveBeenCalledTimes(2)
  })

  it('stops listening once the returned callback runs', () => {
    const refresh = vi.fn(async () => {})
    const stop = registerRefreshOnReturn(refresh)

    stop()
    window.dispatchEvent(new Event('focus'))

    expect(refresh).not.toHaveBeenCalled()
  })
})
