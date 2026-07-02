import { describe, expect, it } from 'vitest'

import { resolveSteps } from './onboardingTours'
import type { CoachStep } from './onboardingTours'

function step(overrides: Partial<CoachStep> = {}): CoachStep {
  return {
    name: 'step',
    placement: 'center',
    ...overrides
  }
}

describe('resolveSteps', () => {
  const isMounted = (mounted: boolean) => () => mounted

  it('keeps a targetless step', () => {
    const steps = [step()]
    expect(resolveSteps(steps, isMounted(false))).toEqual(steps)
  })

  it('drops a step whose target is not mounted', () => {
    const steps = [step({ coachId: 'app-run-button' })]
    expect(resolveSteps(steps, isMounted(false))).toEqual([])
  })

  it('keeps a mounted step', () => {
    const steps = [step({ coachId: 'app-run-button' })]
    expect(resolveSteps(steps, isMounted(true))).toEqual(steps)
  })

  it('keeps a deferred step even before its target mounts', () => {
    const steps = [step({ coachId: 'app-run-button', deferTarget: true })]
    expect(resolveSteps(steps, isMounted(false))).toEqual(steps)
  })

  it('drops a step whose skip target is already mounted', () => {
    const steps = [
      step({
        coachId: 'assets-button',
        deferTarget: true,
        skipIfMounted: 'assets-panel'
      }),
      step({ coachId: 'assets-panel', deferTarget: true })
    ]
    expect(resolveSteps(steps, isMounted(true))).toEqual([steps[1]])
  })

  it('keeps a skip-conditional step when its skip target is not mounted', () => {
    const steps = [
      step({
        coachId: 'assets-button',
        deferTarget: true,
        skipIfMounted: 'assets-panel'
      })
    ]
    expect(resolveSteps(steps, isMounted(false))).toEqual(steps)
  })
})
