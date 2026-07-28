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

/** A target under a moving camera, which reports its motion to whoever asks. */
function movingTarget() {
  const listeners = new Set<() => void>()
  return {
    getBoundingClientRect: () => new DOMRect(10, 10, 80, 40),
    onMove: (notify: () => void) => {
      listeners.add(notify)
      return () => listeners.delete(notify)
    },
    listenerCount: () => listeners.size
  }
}

function mountTarget(target: { getBoundingClientRect: () => DOMRect }) {
  registerCoachmark(COACH_ID, target)
  const scope = effectScope()
  const card = ref<HTMLElement | null>(document.createElement('div'))
  const api = scope.run(() => useCoachmarkTarget(ref(virtualStep()), card))
  return { scope, api }
}

describe('useCoachmarkTarget with a virtual target', () => {
  afterEach(() => {
    clearCoachmarks()
  })

  it('follows a target that reports its own motion', async () => {
    const target = movingTarget()
    const { scope } = mountTarget(target)
    await nextTick()

    expect(
      target.listenerCount(),
      'a target the camera carries moves with no DOM event to announce it'
    ).toBe(1)
    scope.stop()
  })

  it('stops listening once the step is over', async () => {
    const target = movingTarget()
    const { scope } = mountTarget(target)
    await nextTick()

    scope.stop()

    expect(
      target.listenerCount(),
      'a subscription outliving its tour follows the target forever'
    ).toBe(0)
  })

  it('leaves a still target alone, having nothing to subscribe to', async () => {
    const { scope, api } = mountTarget({
      getBoundingClientRect: () => new DOMRect(10, 10, 80, 40)
    })
    await nextTick()

    expect(
      api?.isVirtualTarget.value,
      'a plain rect still counts as virtual, so the ring must not tween after it'
    ).toBe(true)
    scope.stop()
  })
})
