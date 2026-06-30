import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'

import { clearCoachmarks, registerCoachmark } from './coachmarkRegistry'
import type { CoachId, CoachStep } from './onboardingTours'
import { useCoachmarkTarget } from './useCoachmarkTarget'

function setup() {
  const scope = effectScope()
  const step = ref<CoachStep | null>(null)
  const api = scope.run(() => useCoachmarkTarget(step))!
  return { scope, step, api }
}

function stepFor(coachId: CoachId): CoachStep {
  return { titleKey: 't', bodyKey: 'b', placement: 'center', coachId }
}

/** Register an element whose measured rect is driven by `getRect`. */
function mountTarget(coachId: CoachId, getRect: () => DOMRect): HTMLElement {
  const el = document.createElement('div')
  el.getBoundingClientRect = getRect
  registerCoachmark(coachId, el)
  return el
}

describe('useCoachmarkTarget.waitForTarget', () => {
  afterEach(() => {
    clearCoachmarks()
    vi.useRealTimers()
  })

  it('resolves true immediately when the target is already mounted', async () => {
    mountTarget('app-run-button', () => new DOMRect(0, 0, 10, 10))
    const { scope, api } = setup()
    const signal = new AbortController().signal
    await expect(
      api.waitForTarget('app-run-button', signal, 1000)
    ).resolves.toBe(true)
    scope.stop()
  })

  it('resolves true once the target mounts before the timeout', async () => {
    const { scope, api } = setup()
    const signal = new AbortController().signal
    const found = api.waitForTarget('app-run-button', signal, 1000)
    mountTarget('app-run-button', () => new DOMRect(0, 0, 10, 10))
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
    clearCoachmarks()
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
    const getRect = vi.fn(() => new DOMRect(0, 0, 100, 100))
    mountTarget('outputs', getRect)
    const { scope, step, api } = setup()
    step.value = stepFor('outputs')
    api.settle(new AbortController().signal)
    runFrames()
    // First measure differs from the initial empty key (stable resets), then a
    // run of identical measures reaches the window and the loop returns.
    expect(getRect.mock.calls.length).toBeGreaterThan(1)
    expect(frames).toHaveLength(0)
    scope.stop()
  })

  it('terminates at the cap even when the rect never settles', () => {
    let h = 0
    const getRect = vi.fn(() => new DOMRect(0, 0, 100, ++h))
    mountTarget('outputs', getRect)
    const { scope, step, api } = setup()
    step.value = stepFor('outputs')
    api.settle(new AbortController().signal)
    const ran = runFrames()
    // Bounded by the cap, not the safety ceiling — the loop ends on its own.
    expect(ran).toBeLessThan(1000)
    expect(frames).toHaveLength(0)
    scope.stop()
  })

  it('cancels the prior loop instead of stacking when called again', () => {
    mountTarget('outputs', () => new DOMRect(0, 0, 100, 100))
    const { scope, step, api } = setup()
    step.value = stepFor('outputs')
    const signal = new AbortController().signal
    api.settle(signal)
    expect(frames).toHaveLength(1)
    api.settle(signal)
    // Still one queued frame, not two — the prior loop was cancelled.
    expect(frames).toHaveLength(1)
    scope.stop()
  })

  it('stops measuring once the signal aborts', () => {
    const getRect = vi.fn(() => new DOMRect(0, 0, 100, 100))
    mountTarget('outputs', getRect)
    const { scope, step, api } = setup()
    step.value = stepFor('outputs')
    const controller = new AbortController()
    api.settle(controller.signal)
    runFrames(3)
    const before = getRect.mock.calls.length
    controller.abort()
    runFrames()
    expect(getRect.mock.calls.length).toBe(before)
    scope.stop()
  })
})
