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

function deferredStep(coachId: CoachId): CoachStep {
  return {
    titleKey: 't',
    bodyKey: 'b',
    placement: 'center',
    coachId,
    deferTarget: true
  }
}

/** Register an element whose measured rect is driven by `getRect`. */
function mountTarget(coachId: CoachId, getRect: () => DOMRect): HTMLElement {
  const el = document.createElement('div')
  el.getBoundingClientRect = getRect
  registerCoachmark(coachId, el)
  return el
}

// The watch defers its measure a tick, then settle() schedules its first frame.
async function flushSettle() {
  await nextTick()
  await nextTick()
}

describe('useCoachmarkTarget settle', () => {
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

  it('stops once the rect holds steady for the stable-frame window', async () => {
    const getRect = vi.fn(() => new DOMRect(0, 0, 100, 100))
    mountTarget('outputs', getRect)
    const { scope, step } = setup()
    step.value = deferredStep('outputs')
    await flushSettle()
    runFrames()
    // First measure differs from the initial empty key (stable resets), then a
    // run of identical measures reaches the window and the loop returns.
    expect(getRect.mock.calls.length).toBeGreaterThan(1)
    expect(frames).toHaveLength(0)
    scope.stop()
  })

  it('terminates at the cap even when the rect never settles', async () => {
    let h = 0
    const getRect = vi.fn(() => new DOMRect(0, 0, 100, ++h))
    mountTarget('outputs', getRect)
    const { scope, step } = setup()
    step.value = deferredStep('outputs')
    await flushSettle()
    const ran = runFrames()
    // Bounded by the cap, not the safety ceiling — the loop ends on its own.
    expect(ran).toBeLessThan(1000)
    expect(frames).toHaveLength(0)
    scope.stop()
  })

  it('cancels the prior loop instead of stacking when the target swaps', async () => {
    mountTarget('outputs', () => new DOMRect(0, 0, 100, 100))
    const { scope, step } = setup()
    step.value = deferredStep('outputs')
    await flushSettle()
    expect(frames).toHaveLength(1)
    // A second registered element changes the candidate set and re-settles.
    mountTarget('outputs', () => new DOMRect(0, 0, 100, 100))
    await flushSettle()
    // Still one queued frame, not two — the prior loop was cancelled.
    expect(frames).toHaveLength(1)
    scope.stop()
  })

  it('stops measuring once the scope is disposed', async () => {
    const getRect = vi.fn(() => new DOMRect(0, 0, 100, 100))
    mountTarget('outputs', getRect)
    const { scope, step } = setup()
    step.value = deferredStep('outputs')
    await flushSettle()
    runFrames(3)
    const before = getRect.mock.calls.length
    scope.stop()
    runFrames()
    expect(getRect.mock.calls.length).toBe(before)
  })
})
