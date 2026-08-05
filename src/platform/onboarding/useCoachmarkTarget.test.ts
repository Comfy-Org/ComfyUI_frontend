import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'

import { clearCoachmarks, registerCoachmark } from './coachmarkRegistry'
import {
  hidden,
  laidOut,
  mountNode,
  movingTarget
} from './fixtures/coachmarkTargets'
import type { CoachId, SpotlightStep } from './onboardingTours'
import { isSettling, useCoachmarkTarget } from './useCoachmarkTarget'

function step(coachId: CoachId): SpotlightStep {
  return { kind: 'spotlight', name: 'step', placement: 'right', coachId }
}

// Floating UI does not compute in happy-dom, so the card's placement is
// browser-verified. These assert which candidate is anchored, and its lifecycle.
describe('useCoachmarkTarget', () => {
  afterEach(() => {
    clearCoachmarks()
    document.body.replaceChildren()
    vi.restoreAllMocks()
  })

  function setup(coachId: CoachId) {
    const scope = effectScope()
    const stepRef = ref<SpotlightStep | null>(step(coachId))
    const cardRef = ref<HTMLElement | null>(null)
    const api = scope.run(() => useCoachmarkTarget(stepRef, cardRef))!
    return { scope, api }
  }

  it('skips a registered candidate that is not laid out', () => {
    registerCoachmark('outputs', hidden())
    mountNode()
    registerCoachmark('outputs', movingTarget())
    const { scope, api } = setup('outputs')

    expect(
      api.targetMoves.value,
      'a hidden candidate must not win over one that is actually on screen'
    ).toBe(true)
    scope.stop()
  })

  it('anchors to the first laid-out candidate', () => {
    registerCoachmark('outputs', laidOut())
    mountNode()
    registerCoachmark('outputs', movingTarget())
    const { scope, api } = setup('outputs')

    expect(
      api.targetMoves.value,
      'a still target sharing a coach id loses its glide if an unrelated one moves'
    ).toBe(false)
    scope.stop()
  })

  it('has nothing to anchor to while its node is unmounted', () => {
    registerCoachmark('outputs', movingTarget())
    const { scope, api } = setup('outputs')

    expect(
      api.targetMoves.value,
      'a step with nothing on screen has no motion to describe'
    ).toBe(false)
    scope.stop()
  })

  it('picks up a candidate that registers after the step starts', () => {
    const { scope, api } = setup('outputs')
    expect(api.targetMoves.value).toBe(false)

    mountNode()
    registerCoachmark('outputs', movingTarget())

    expect(
      api.targetMoves.value,
      'the tour registers its canvas target before the node renders'
    ).toBe(true)
    scope.stop()
  })

  it('subscribes to its motion, which fires no DOM event', async () => {
    mountNode()
    const target = movingTarget()
    registerCoachmark('outputs', target)
    const { scope } = setup('outputs')
    await nextTick()

    expect(target.listenerCount()).toBe(1)

    scope.stop()
    expect(
      target.listenerCount(),
      'a subscription outliving its tour follows the node forever'
    ).toBe(0)
  })

  it('follows only the candidate it anchored to', () => {
    const elsewhere = movingTarget('8')
    registerCoachmark('outputs', elsewhere)
    mountNode()
    const anchored = movingTarget()
    registerCoachmark('outputs', anchored)
    const { scope } = setup('outputs')

    expect(anchored.listenerCount()).toBe(1)
    expect(
      elsewhere.listenerCount(),
      'a candidate the card is not anchored to must not reposition it'
    ).toBe(0)
    scope.stop()
  })
})

describe('isSettling', () => {
  const rect = new DOMRect(0, 0, 10, 10)
  const moved = new DOMRect(5, 0, 10, 10)
  const deferred: SpotlightStep = {
    kind: 'spotlight',
    name: 'step',
    placement: 'right',
    deferTarget: true
  }

  it('does not track a step whose target is already in place', () => {
    expect(
      isSettling({ ...deferred, deferTarget: false }, rect, moved),
      'an undeferred target never animates in, so nothing needs following'
    ).toBe(false)
  })

  it('tracks a deferred target while its rect is still moving', () => {
    expect(isSettling(deferred, moved, rect)).toBe(true)
  })

  it('stops tracking once the rect has held still', () => {
    expect(
      isSettling(deferred, rect, rect),
      'tracking that never disarms leaves a frame loop running for the tour'
    ).toBe(false)
  })
})
