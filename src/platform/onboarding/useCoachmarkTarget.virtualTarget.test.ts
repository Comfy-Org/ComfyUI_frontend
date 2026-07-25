import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'

import { COACH_IDS } from './onboardingTours'
import type { CoachStep } from './onboardingTours'
import { clearCoachmarks, registerCoachmark } from './coachmarkRegistry'
import { useCoachmarkTarget } from './useCoachmarkTarget'

const COACH_ID = COACH_IDS.inputsList

function virtualStep(): CoachStep {
  return { name: 'inputs', placement: 'auto', coachId: COACH_ID }
}

async function nextFrame() {
  vi.advanceTimersToNextFrame()
  await nextTick()
}

/** A target under a moving camera: every read reports a different position. */
function movingTarget() {
  let reads = 0
  return {
    getBoundingClientRect: () => {
      reads++
      return new DOMRect(reads, reads, 80, 40)
    },
    readCount: () => reads
  }
}

describe('useCoachmarkTarget with a virtual target', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    clearCoachmarks()
    vi.useRealTimers()
  })

  async function trackFrames(frames: number) {
    const target = movingTarget()
    registerCoachmark(COACH_ID, target)
    const scope = effectScope()
    const card = ref<HTMLElement | null>(document.createElement('div'))
    const api = scope.run(() => useCoachmarkTarget(ref(virtualStep()), card))!
    await nextTick()

    const before = target.readCount()
    for (let i = 0; i < frames; i++) await nextFrame()
    const sampled = target.readCount() - before

    scope.stop()
    return { api, sampled }
  }

  it('reads the moving target once per frame however many things follow it', async () => {
    const { sampled } = await trackFrames(3)

    expect(
      sampled,
      'the spotlight and the card must trace one sample, or they drift a frame apart on screen'
    ).toBe(3)
  })

  it('stops sampling once the step is over', async () => {
    const target = movingTarget()
    registerCoachmark(COACH_ID, target)
    const scope = effectScope()
    const card = ref<HTMLElement | null>(document.createElement('div'))
    scope.run(() => useCoachmarkTarget(ref(virtualStep()), card))
    await nextFrame()

    scope.stop()
    const afterStop = target.readCount()
    await nextFrame()

    expect(
      target.readCount(),
      'a loop outliving its tour polls the target forever'
    ).toBe(afterStop)
  })
})
