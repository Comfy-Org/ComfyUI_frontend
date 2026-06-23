import { describe, expect, it } from 'vitest'

import { coachTarget, passesGate, resolveSteps } from './onboardingTours'
import type { CoachStep } from './onboardingTours'

function step(overrides: Partial<CoachStep> = {}): CoachStep {
  return {
    titleKey: 'title',
    bodyKey: 'body',
    placement: 'center',
    ...overrides
  }
}

describe('coachTarget', () => {
  it('builds a selector for a single coach id', () => {
    expect(coachTarget('run-button')).toBe('[data-coach-id="run-button"]')
  })

  it('builds a candidate list selector for multiple coach ids', () => {
    expect(coachTarget(['run-button', 'app-run-button'])).toBe(
      '[data-coach-id="run-button"], [data-coach-id="app-run-button"]'
    )
  })
})

describe('passesGate', () => {
  it('passes a step with no gate', async () => {
    expect(await passesGate(step())).toBe(true)
  })

  it('passes when the gate resolves true', async () => {
    expect(await passesGate(step({ when: async () => true }))).toBe(true)
  })

  it('skips when the gate resolves false', async () => {
    expect(await passesGate(step({ when: async () => false }))).toBe(false)
  })

  it('skips (without crashing) when the gate throws', async () => {
    const when = () => {
      throw new Error('gate blew up')
    }
    expect(await passesGate(step({ when }))).toBe(false)
  })

  it('skips when the gate rejects', async () => {
    const when = async () => {
      throw new Error('gate blew up')
    }
    expect(await passesGate(step({ when }))).toBe(false)
  })
})

describe('resolveSteps', () => {
  const isMounted = (mounted: boolean) => () => mounted

  it('keeps a targetless step', async () => {
    const steps = [step()]
    expect(
      await resolveSteps(steps, {
        bypassGates: true,
        isMounted: isMounted(false)
      })
    ).toEqual(steps)
  })

  it('drops a step whose target is not mounted', async () => {
    const steps = [step({ coachId: 'run-button' })]
    expect(
      await resolveSteps(steps, {
        bypassGates: true,
        isMounted: isMounted(false)
      })
    ).toEqual([])
  })

  it('keeps a deferred step even before its target mounts', async () => {
    const steps = [step({ coachId: 'run-button', deferTarget: true })]
    expect(
      await resolveSteps(steps, {
        bypassGates: true,
        isMounted: isMounted(false)
      })
    ).toEqual(steps)
  })

  it('drops a step whose gate fails', async () => {
    const steps = [step({ when: async () => false })]
    expect(
      await resolveSteps(steps, {
        bypassGates: false,
        isMounted: isMounted(true)
      })
    ).toEqual([])
  })

  it('drops a step whose gate throws instead of crashing the tour', async () => {
    const when = () => {
      throw new Error('gate blew up')
    }
    const steps = [step({ when }), step()]
    const resolved = await resolveSteps(steps, {
      bypassGates: false,
      isMounted: isMounted(true)
    })
    expect(resolved).toEqual([steps[1]])
  })

  it('ignores gates when replaying past them', async () => {
    const steps = [step({ when: async () => false })]
    expect(
      await resolveSteps(steps, {
        bypassGates: true,
        isMounted: isMounted(true)
      })
    ).toEqual(steps)
  })
})
