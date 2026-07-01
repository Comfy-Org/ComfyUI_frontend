import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createRafBatch } from '@/utils/rafBatch'

describe('createRafBatch', () => {
  const callbacks = new Map<number, FrameRequestCallback>()
  const cancelAnimationFrame = vi.fn()

  beforeEach(() => {
    callbacks.clear()
    cancelAnimationFrame.mockClear()
    let nextId = 0
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((callback: FrameRequestCallback) => {
        const id = ++nextId
        callbacks.set(id, callback)
        return id
      })
    )
    vi.stubGlobal('cancelAnimationFrame', cancelAnimationFrame)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('coalesces scheduled work into one animation frame', () => {
    const run = vi.fn()
    const batch = createRafBatch(run)

    batch.schedule()
    batch.schedule()

    expect(requestAnimationFrame).toHaveBeenCalledOnce()
    expect(batch.isScheduled()).toBe(true)

    callbacks.get(1)?.(0)

    expect(run).toHaveBeenCalledOnce()
    expect(batch.isScheduled()).toBe(false)
  })

  it('cancels and flushes scheduled work', () => {
    const run = vi.fn()
    const batch = createRafBatch(run)

    batch.cancel()
    batch.flush()

    expect(cancelAnimationFrame).not.toHaveBeenCalled()
    expect(run).not.toHaveBeenCalled()

    batch.schedule()
    batch.cancel()

    expect(cancelAnimationFrame).toHaveBeenCalledWith(1)
    expect(batch.isScheduled()).toBe(false)

    batch.schedule()
    batch.flush()

    expect(cancelAnimationFrame).toHaveBeenCalledWith(2)
    expect(run).toHaveBeenCalledOnce()
    expect(batch.isScheduled()).toBe(false)
  })
})
