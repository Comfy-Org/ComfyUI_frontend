import { describe, expect, it } from 'vitest'

import { COACH_IDS, resolveSteps } from './onboardingTours'
import type { CoachStep, SpotlightStep } from './onboardingTours'

function step(overrides: Partial<SpotlightStep> = {}): SpotlightStep {
  return {
    kind: 'spotlight',
    name: 'step',
    placement: 'center',
    ...overrides
  }
}

describe('CoachStep', () => {
  it('refuses a landing step that also spotlights a target', () => {
    const landing: CoachStep = {
      kind: 'landing',
      name: 'landing',
      // @ts-expect-error a landing renders no spotlight, so it has no target
      coachId: COACH_IDS.inputsList
    }

    expect(landing.kind).toBe('landing')
  })
})

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
})
