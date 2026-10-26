import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('idle scheduling without browser idle callbacks', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubGlobal('requestIdleCallback', undefined)
    vi.stubGlobal('cancelIdleCallback', undefined)
  })

  it('defers work and supplies a nonnegative remaining time budget', async () => {
    const { runWhenGlobalIdle } = await import('./async')
    const budgets: number[] = []
    runWhenGlobalIdle((deadline) => {
      budgets.push(deadline.timeRemaining())
      vi.setSystemTime(Date.now() + 20)
      budgets.push(deadline.timeRemaining())
    })

    expect(budgets).toEqual([])
    vi.runAllTimers()
    expect(budgets).toEqual([15, 0])
  })

  it('prevents disposed work from running while allowing other work', async () => {
    const { runWhenGlobalIdle } = await import('./async')
    const completed: string[] = []
    const cancelled = runWhenGlobalIdle(() => completed.push('cancelled'))
    runWhenGlobalIdle(() => completed.push('retained'))

    cancelled.dispose()
    cancelled.dispose()
    vi.runAllTimers()

    expect(completed).toEqual(['retained'])
  })
})

describe('native browser idle scheduling', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it.for([
    { timeout: undefined, options: undefined },
    { timeout: 125, options: { timeout: 125 } }
  ])(
    'preserves the requested timeout $timeout',
    async ({ timeout, options }) => {
      const request = vi.fn<typeof requestIdleCallback>(() => 17)
      vi.stubGlobal('requestIdleCallback', request)
      vi.stubGlobal('cancelIdleCallback', vi.fn())
      const { runWhenGlobalIdle } = await import('./async')
      const callback = vi.fn()

      runWhenGlobalIdle(callback, timeout)

      expect(request).toHaveBeenCalledWith(callback, options)
    }
  )

  it('cancels its own browser callback only once', async () => {
    vi.stubGlobal(
      'requestIdleCallback',
      vi.fn(() => 17)
    )
    const cancel = vi.fn()
    vi.stubGlobal('cancelIdleCallback', cancel)
    const { runWhenGlobalIdle } = await import('./async')

    const scheduled = runWhenGlobalIdle(vi.fn())
    scheduled.dispose()
    scheduled.dispose()

    expect(cancel).toHaveBeenCalledExactlyOnceWith(17)
  })
})
