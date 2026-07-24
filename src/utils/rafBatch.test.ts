import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createRafCoalescer } from '@/utils/rafBatch'

describe('createRafCoalescer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('applies the latest pushed value on the next frame', () => {
    const apply = vi.fn()
    const coalescer = createRafCoalescer<number>(apply)

    coalescer.push(1)
    coalescer.push(2)
    coalescer.push(3)

    expect(apply).not.toHaveBeenCalled()

    vi.advanceTimersByTime(16)

    expect(apply).toHaveBeenCalledOnce()
    expect(apply).toHaveBeenCalledWith(3)
  })

  it('does not apply after cancel', () => {
    const apply = vi.fn()
    const coalescer = createRafCoalescer<number>(apply)

    coalescer.push(42)
    coalescer.cancel()

    vi.advanceTimersByTime(16)

    expect(apply).not.toHaveBeenCalled()
  })

  it('applies immediately on flush', () => {
    const apply = vi.fn()
    const coalescer = createRafCoalescer<number>(apply)

    coalescer.push(99)
    coalescer.flush()

    expect(apply).toHaveBeenCalledOnce()
    expect(apply).toHaveBeenCalledWith(99)
  })

  it('does nothing on flush when no value is pending', () => {
    const apply = vi.fn()
    const coalescer = createRafCoalescer<number>(apply)

    coalescer.flush()

    expect(apply).not.toHaveBeenCalled()
  })

  it('does not double-apply after flush', () => {
    const apply = vi.fn()
    const coalescer = createRafCoalescer<number>(apply)

    coalescer.push(1)
    coalescer.flush()

    vi.advanceTimersByTime(16)

    expect(apply).toHaveBeenCalledOnce()
  })

  it('reports scheduled state correctly', () => {
    const coalescer = createRafCoalescer<number>(vi.fn())

    expect(coalescer.isScheduled()).toBe(false)

    coalescer.push(1)
    expect(coalescer.isScheduled()).toBe(true)

    vi.advanceTimersByTime(16)
    expect(coalescer.isScheduled()).toBe(false)
  })
})
