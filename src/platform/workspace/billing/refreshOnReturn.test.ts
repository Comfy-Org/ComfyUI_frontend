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

  it('is one-shot: a second return does not refetch', () => {
    const refresh = vi.fn(async () => {})
    registerRefreshOnReturn(refresh)

    window.dispatchEvent(new Event('focus'))
    window.dispatchEvent(new Event('focus'))

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
