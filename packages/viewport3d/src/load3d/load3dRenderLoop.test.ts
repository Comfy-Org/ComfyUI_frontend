import { describe, expect, it, vi } from 'vitest'

import { startRenderLoop } from './load3dRenderLoop'

describe('startRenderLoop', () => {
  it('runs tick on each frame while isActive returns true', () => {
    const tick = vi.fn()
    const handle = startRenderLoop({ tick, isActive: () => true })

    vi.advanceTimersToNextTimer()
    vi.advanceTimersToNextTimer()
    vi.advanceTimersToNextTimer()

    expect(tick.mock.calls.length).toBeGreaterThanOrEqual(3)
    handle.stop()
  })

  it('schedules no frames while inactive and resumes ticking on wake', () => {
    let active = false
    const tick = vi.fn()
    const handle = startRenderLoop({ tick, isActive: () => active })

    expect(vi.getTimerCount()).toBe(0)

    active = true
    vi.advanceTimersToNextTimer()
    expect(tick).not.toHaveBeenCalled()

    handle.wake()
    vi.advanceTimersToNextTimer()
    expect(tick).toHaveBeenCalledOnce()

    handle.stop()
  })

  it('wake after stop schedules nothing', () => {
    const handle = startRenderLoop({ tick: vi.fn(), isActive: () => false })

    handle.stop()
    handle.wake()

    expect(vi.getTimerCount()).toBe(0)
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
