import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'

import { useCarouselAutoplay } from './useCarouselAutoplay'

function runInScope(fn: () => void): () => void {
  const scope = effectScope()
  scope.run(fn)
  return () => scope.stop()
}

describe('useCarouselAutoplay', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('advances after the active slide delay elapses', () => {
    const index = ref(0)
    const advance = vi.fn(() => {
      index.value += 1
    })

    const stop = runInScope(() =>
      useCarouselAutoplay({
        delayMs: 3000,
        active: () => true,
        resetKey: index,
        advance
      })
    )

    vi.advanceTimersByTime(2999)
    expect(advance).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(advance).toHaveBeenCalledTimes(1)

    stop()
  })

  it('uses each slide own duration on the next advance', async () => {
    const durations = [3000, 8000]
    const index = ref(0)
    const advance = vi.fn(() => {
      index.value += 1
    })

    const stop = runInScope(() =>
      useCarouselAutoplay({
        delayMs: () => durations[index.value],
        active: () => true,
        resetKey: index,
        advance
      })
    )

    vi.advanceTimersByTime(3000)
    expect(advance).toHaveBeenCalledTimes(1)
    await nextTick()

    vi.advanceTimersByTime(3000)
    expect(advance).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(5000)
    expect(advance).toHaveBeenCalledTimes(2)

    stop()
  })

  it('does not start while inactive', () => {
    const advance = vi.fn()

    const stop = runInScope(() =>
      useCarouselAutoplay({
        delayMs: 3000,
        active: () => false,
        resetKey: ref(0),
        advance
      })
    )

    vi.advanceTimersByTime(10000)
    expect(advance).not.toHaveBeenCalled()

    stop()
  })

  it('stops when it becomes inactive', async () => {
    const active = ref(true)
    const advance = vi.fn()

    const stop = runInScope(() =>
      useCarouselAutoplay({
        delayMs: 3000,
        active,
        resetKey: ref(0),
        advance
      })
    )

    vi.advanceTimersByTime(1000)
    active.value = false
    await nextTick()

    vi.advanceTimersByTime(10000)
    expect(advance).not.toHaveBeenCalled()

    stop()
  })

  it('resets the timer when the active slide changes', async () => {
    const index = ref(0)
    const advance = vi.fn()

    const stop = runInScope(() =>
      useCarouselAutoplay({
        delayMs: 3000,
        active: () => true,
        resetKey: index,
        advance
      })
    )

    vi.advanceTimersByTime(2000)
    index.value = 1
    await nextTick()

    vi.advanceTimersByTime(2000)
    expect(advance).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1000)
    expect(advance).toHaveBeenCalledTimes(1)

    stop()
  })
})
