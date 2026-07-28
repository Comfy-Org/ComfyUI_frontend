import { afterEach, describe, expect, it } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'

import { COACH_IDS } from './onboardingTours'
import type { CoachStep } from './onboardingTours'
import { clearCoachmarks, registerCoachmark } from './coachmarkRegistry'
import { useCoachmarkTarget } from './useCoachmarkTarget'

const COACH_ID = COACH_IDS.inputsList

function virtualStep(): CoachStep {
  return { name: 'inputs', placement: 'auto', coachId: COACH_ID }
}

/** A target under a moving camera: every read reports a different position. */
function movingTarget() {
  let reads = 0
  const listeners = new Set<() => void>()
  return {
    getBoundingClientRect: () => {
      reads++
      return new DOMRect(reads, reads, 80, 40)
    },
    onMove: (notify: () => void) => {
      listeners.add(notify)
      return () => listeners.delete(notify)
    },
    move: () => listeners.forEach((notify) => notify()),
    readCount: () => reads,
    listenerCount: () => listeners.size
  }
}

/** A virtual target that never moves, so it offers nothing to subscribe to. */
function stillTarget() {
  let reads = 0
  return {
    getBoundingClientRect: () => {
      reads++
      return new DOMRect(10, 10, 80, 40)
    },
    readCount: () => reads
  }
}

function mountTarget(target: { getBoundingClientRect: () => DOMRect }) {
  registerCoachmark(COACH_ID, target)
  const scope = effectScope()
  const card = ref<HTMLElement | null>(document.createElement('div'))
  scope.run(() => useCoachmarkTarget(ref(virtualStep()), card))
  return { scope }
}

describe('useCoachmarkTarget with a virtual target', () => {
  afterEach(() => {
    clearCoachmarks()
  })

  it('traces a target that never moves, which has no subscription to offer', async () => {
    const target = stillTarget()
    const { scope } = mountTarget(target)
    await nextTick()

    expect(
      target.readCount(),
      'the card positions against the sample, so an unsampled target sits at the zero rect'
    ).toBe(2)
    scope.stop()
  })

  it('traces the target on arrival, before it has moved at all', async () => {
    const target = movingTarget()
    const { scope } = mountTarget(target)
    await nextTick()

    expect(
      target.readCount(),
      'a step on a still canvas would otherwise show no spotlight until the user pans'
    ).toBe(2)
    scope.stop()
  })

  it('reads the moving target once per move however many things follow it', async () => {
    const target = movingTarget()
    const { scope } = mountTarget(target)
    await nextTick()

    const before = target.readCount()
    target.move()
    target.move()
    await nextTick()

    expect(
      target.readCount() - before,
      'the spotlight and the card must trace one sample, or they drift apart on screen'
    ).toBe(2)
    scope.stop()
  })

  it('stops listening once the step is over', async () => {
    const target = movingTarget()
    const { scope } = mountTarget(target)
    await nextTick()
    expect(target.listenerCount()).toBe(1)

    scope.stop()

    expect(
      target.listenerCount(),
      'a subscription outliving its tour follows the target forever'
    ).toBe(0)
  })
})
