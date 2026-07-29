import { afterEach, describe, expect, it } from 'vitest'
import { effectScope, ref } from 'vue'

import { clearCoachmarks, registerCoachmark } from './coachmarkRegistry'
import type { CoachId, CoachStep } from './onboardingTours'
import { useCoachmarkTarget } from './useCoachmarkTarget'

function step(coachId: CoachId): CoachStep {
  return { name: 'step', placement: 'right', coachId }
}

function laidOut(): HTMLElement {
  const el = document.createElement('div')
  el.getBoundingClientRect = () => new DOMRect(10, 10, 80, 30)
  return el
}

function hidden(): HTMLElement {
  const el = document.createElement('div')
  el.getBoundingClientRect = () => new DOMRect(0, 0, 0, 0)
  return el
}

describe('useCoachmarkTarget', () => {
  afterEach(clearCoachmarks)

  function setup(coachId: CoachId) {
    const scope = effectScope()
    const stepRef = ref<CoachStep | null>(step(coachId))
    const cardRef = ref<HTMLElement | null>(null)
    const api = scope.run(() => useCoachmarkTarget(stepRef, cardRef))!
    return { scope, api }
  }

  it('resolves the first laid-out candidate for the step target', () => {
    const el = laidOut()
    registerCoachmark('outputs', el)
    const { scope, api } = setup('outputs')
    expect(api.targetEl.value).toBe(el)
    scope.stop()
  })

  it('skips a registered target that is not laid out', () => {
    registerCoachmark('outputs', hidden())
    const laid = laidOut()
    registerCoachmark('outputs', laid)
    const { scope, api } = setup('outputs')
    expect(api.targetEl.value).toBe(laid)
    scope.stop()
  })

  it('picks up a target that registers after the step starts', () => {
    const { scope, api } = setup('outputs')
    expect(api.targetEl.value).toBeNull()

    const el = laidOut()
    registerCoachmark('outputs', el)
    expect(api.targetEl.value).toBe(el)
    scope.stop()
  })
})
