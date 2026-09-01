import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { startRenderLoop } from './load3dRenderLoop'

describe('startRenderLoop', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('runs tick on each frame while isActive returns true', () => {
    const tick = vi.fn()
    const handle = startRenderLoop({ tick, isActive: () => true })

    vi.advanceTimersToNextTimer()
    vi.advanceTimersToNextTimer()
    vi.advanceTimersToNextTimer()

    expect(tick.mock.calls.length).toBeGreaterThanOrEqual(3)
    handle.stop()
  })

  it('skips tick on frames where isActive returns false', () => {
    let active = false
    const tick = vi.fn()
    const handle = startRenderLoop({ tick, isActive: () => active })

    vi.advanceTimersToNextTimer()
    vi.advanceTimersToNextTimer()
    expect(tick).not.toHaveBeenCalled()

    active = true
    vi.advanceTimersToNextTimer()
    expect(tick).toHaveBeenCalledOnce()

    handle.stop()
  })

  it('stop halts further ticks', () => {
    const tick = vi.fn()
    const handle = startRenderLoop({ tick, isActive: () => true })

    vi.advanceTimersToNextTimer()
    const callsBeforeStop = tick.mock.calls.length

    handle.stop()
    vi.advanceTimersToNextTimer()
    vi.advanceTimersToNextTimer()

    expect(tick.mock.calls.length).toBe(callsBeforeStop)
  })

  it('is safe to call stop multiple times', () => {
    const handle = startRenderLoop({ tick: vi.fn(), isActive: () => true })

    handle.stop()
    expect(() => handle.stop()).not.toThrow()
  })
})
