import { afterEach, describe, expect, it, vi } from 'vitest'

type IdleCallback = (deadline: {
  didTimeout: boolean
  timeRemaining(): number
}) => void

async function importRunWhenGlobalIdle() {
  vi.resetModules()
  return (await import('@/base/common/async')).runWhenGlobalIdle
}

describe('runWhenGlobalIdle', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('uses a timer fallback when idle callbacks are unavailable', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('requestIdleCallback', undefined)
    vi.stubGlobal('cancelIdleCallback', undefined)

    const runWhenGlobalIdle = await importRunWhenGlobalIdle()
    const callback = vi.fn<IdleCallback>()

    runWhenGlobalIdle(callback)

    expect(callback).not.toHaveBeenCalled()

    vi.runOnlyPendingTimers()

    expect(callback).toHaveBeenCalledOnce()

    const [deadline] = callback.mock.calls[0]
    expect(deadline.didTimeout).toBe(true)
    expect(deadline.timeRemaining()).toBeGreaterThanOrEqual(0)
    expect(Object.isFrozen(deadline)).toBe(true)
  })

  it('can dispose a fallback callback before the timer runs', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('requestIdleCallback', undefined)
    vi.stubGlobal('cancelIdleCallback', undefined)

    const runWhenGlobalIdle = await importRunWhenGlobalIdle()
    const callback = vi.fn<IdleCallback>()

    const idleRunner = runWhenGlobalIdle(callback)
    idleRunner.dispose()
    idleRunner.dispose()

    vi.runOnlyPendingTimers()

    expect(callback).not.toHaveBeenCalled()
  })

  it('uses native idle callbacks when available', async () => {
    let idleCallback: IdleRequestCallback | undefined
    const requestIdleCallback = vi.fn(
      (callback: IdleRequestCallback, options?: IdleRequestOptions) => {
        idleCallback = callback
        expect(options).toEqual({ timeout: 50 })
        return 7
      }
    )
    const cancelIdleCallback = vi.fn()
    vi.stubGlobal('requestIdleCallback', requestIdleCallback)
    vi.stubGlobal('cancelIdleCallback', cancelIdleCallback)

    const runWhenGlobalIdle = await importRunWhenGlobalIdle()
    const callback = vi.fn<IdleCallback>()

    const idleRunner = runWhenGlobalIdle(callback, 50)
    idleCallback?.({ didTimeout: false, timeRemaining: () => 10 })
    idleRunner.dispose()
    idleRunner.dispose()

    expect(requestIdleCallback).toHaveBeenCalledOnce()
    expect(callback).toHaveBeenCalledWith({
      didTimeout: false,
      timeRemaining: expect.any(Function)
    })
    expect(cancelIdleCallback).toHaveBeenCalledExactlyOnceWith(7)
  })

  it('omits native idle timeout options when no timeout is provided', async () => {
    const requestIdleCallback = vi.fn(() => 9)
    vi.stubGlobal('requestIdleCallback', requestIdleCallback)
    vi.stubGlobal('cancelIdleCallback', vi.fn())

    const runWhenGlobalIdle = await importRunWhenGlobalIdle()

    runWhenGlobalIdle(vi.fn())

    expect(requestIdleCallback).toHaveBeenCalledWith(
      expect.any(Function),
      undefined
    )
  })
})
