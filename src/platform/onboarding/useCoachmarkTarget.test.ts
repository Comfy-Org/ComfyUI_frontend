import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'

import { registerCoachmark, unregisterCoachmark } from './coachmarkRegistry'
import type { CoachStep } from './onboardingTours'
import { useCoachmarkTarget } from './useCoachmarkTarget'

function setup() {
  const scope = effectScope()
  const step = ref<CoachStep | null>(null)
  const api = scope.run(() => useCoachmarkTarget(step))!
  return { scope, step, api }
}

function stepWithRect(rectOverride: () => DOMRect): CoachStep {
  return { titleKey: 't', bodyKey: 'b', placement: 'center', rectOverride }
}

describe('useCoachmarkTarget.waitForTarget', () => {
  const mounted = new Set<HTMLElement>()

  afterEach(() => {
    for (const el of mounted) unregisterCoachmark('run-button', el)
    mounted.clear()
    vi.useRealTimers()
  })

  function mount(): HTMLElement {
    const el = document.createElement('div')
    registerCoachmark('run-button', el)
    mounted.add(el)
    return el
  }

  it('resolves true immediately when the target is already mounted', async () => {
    mount()
    const { scope, api } = setup()
    const signal = new AbortController().signal
    await expect(api.waitForTarget('run-button', signal, 1000)).resolves.toBe(
      true
    )
    scope.stop()
  })

  it('resolves true once the target mounts before the timeout', async () => {
    const { scope, api } = setup()
    const signal = new AbortController().signal
    const found = api.waitForTarget('run-button', signal, 1000)
    mount()
    await nextTick()
    await expect(found).resolves.toBe(true)
    scope.stop()
  })

  it('resolves false when the target never mounts (transient failure)', async () => {
    vi.useFakeTimers()
    const { scope, api } = setup()
    const signal = new AbortController().signal
    const found = api.waitForTarget('outputs', signal, 1000)
    await vi.advanceTimersByTimeAsync(1000)
    await expect(found).resolves.toBe(false)
    scope.stop()
  })

  it('resolves false when the step is aborted before the target mounts', async () => {
    const { scope, api } = setup()
    const controller = new AbortController()
    const found = api.waitForTarget('outputs', controller.signal, 10000)
    controller.abort()
    await expect(found).resolves.toBe(false)
    scope.stop()
  })
})

describe('useCoachmarkTarget.settle', () => {
  let frames: Array<{ id: number; cb: FrameRequestCallback }>
  let nextFrameId: number

  beforeEach(() => {
    frames = []
    nextFrameId = 1
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      const id = nextFrameId++
      frames.push({ id, cb })
      return id
    })
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      frames = frames.filter((f) => f.id !== id)
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  // settle() schedules one frame at a time, each scheduling the next; drain the
  // queue (with a hard ceiling so a non-terminating loop fails instead of hangs).
  function runFrames(max = 1000) {
    let ran = 0
    while (frames.length && ran < max) {
      frames.shift()!.cb(0)
      ran++
    }
    return ran
  }

  it('stops once the rect holds steady for the stable-frame window', () => {
    const { scope, step, api } = setup()
    const rectOverride = vi.fn(() => new DOMRect(0, 0, 100, 100))
    step.value = stepWithRect(rectOverride)
    api.settle(new AbortController().signal)
    runFrames()
    // First measure differs from the initial empty key (stable resets), then a
    // run of identical measures reaches the window and the loop returns.
    expect(rectOverride.mock.calls.length).toBeGreaterThan(1)
    expect(frames).toHaveLength(0)
    scope.stop()
  })

  it('terminates at the cap even when the rect never settles', () => {
    const { scope, step, api } = setup()
    let h = 0
    const rectOverride = vi.fn(() => new DOMRect(0, 0, 100, ++h))
    step.value = stepWithRect(rectOverride)
    api.settle(new AbortController().signal)
    const ran = runFrames()
    // Bounded by the cap, not the safety ceiling — the loop ends on its own.
    expect(ran).toBeLessThan(1000)
    expect(frames).toHaveLength(0)
    scope.stop()
  })

  it('cancels the prior loop instead of stacking when called again', () => {
    const { scope, step, api } = setup()
    step.value = stepWithRect(() => new DOMRect(0, 0, 100, 100))
    const signal = new AbortController().signal
    api.settle(signal)
    expect(frames).toHaveLength(1)
    api.settle(signal)
    // Still one queued frame, not two — the prior loop was cancelled.
    expect(frames).toHaveLength(1)
    scope.stop()
  })

  it('stops measuring once the signal aborts', () => {
    const { scope, step, api } = setup()
    const rectOverride = vi.fn(() => new DOMRect(0, 0, 100, 100))
    step.value = stepWithRect(rectOverride)
    const controller = new AbortController()
    api.settle(controller.signal)
    runFrames(3)
    const before = rectOverride.mock.calls.length
    controller.abort()
    runFrames()
    expect(rectOverride.mock.calls.length).toBe(before)
    scope.stop()
  })
})
