import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('runWhenGlobalIdle', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('falls back to a timeout when idle callbacks are unavailable', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('requestIdleCallback', undefined)
    vi.stubGlobal('cancelIdleCallback', undefined)
    const { runWhenGlobalIdle } = await import('./async')
    const runner = vi.fn()

    const disposable = runWhenGlobalIdle(runner)
    await vi.runAllTimersAsync()

    expect(runner).toHaveBeenCalledOnce()
    const deadline = runner.mock.calls[0][0]
    expect(deadline.didTimeout).toBe(true)
    expect(deadline.timeRemaining()).toBeGreaterThanOrEqual(0)

    disposable.dispose()
    disposable.dispose()
  })

  it('cancels fallback idle work before it runs', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('requestIdleCallback', undefined)
    vi.stubGlobal('cancelIdleCallback', undefined)
    const { runWhenGlobalIdle } = await import('./async')
    const runner = vi.fn()

    runWhenGlobalIdle(runner).dispose()
    await vi.runAllTimersAsync()

    expect(runner).not.toHaveBeenCalled()
  })

  it('uses native idle callbacks when available', async () => {
    const requestIdleCallback = vi.fn(() => 42)
    const cancelIdleCallback = vi.fn()
    vi.stubGlobal('requestIdleCallback', requestIdleCallback)
    vi.stubGlobal('cancelIdleCallback', cancelIdleCallback)
    const { runWhenGlobalIdle } = await import('./async')
    const runner = vi.fn()

    const disposable = runWhenGlobalIdle(runner, 250)

    expect(requestIdleCallback).toHaveBeenCalledWith(runner, { timeout: 250 })

    disposable.dispose()
    disposable.dispose()

    expect(cancelIdleCallback).toHaveBeenCalledOnce()
    expect(cancelIdleCallback).toHaveBeenCalledWith(42)
  })

  it('omits native idle timeout options when no timeout is supplied', async () => {
    const requestIdleCallback = vi.fn(() => 7)
    vi.stubGlobal('requestIdleCallback', requestIdleCallback)
    vi.stubGlobal('cancelIdleCallback', vi.fn())
    const { runWhenGlobalIdle } = await import('./async')
    const runner = vi.fn()

    runWhenGlobalIdle(runner)

    expect(requestIdleCallback).toHaveBeenCalledWith(runner, undefined)
  })
})
