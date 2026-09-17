import { nextTick, ref } from 'vue'
import { beforeEach, describe, expect, it } from 'vitest'

import type { CoachStep } from './useOnboarding'
import { useOnboarding } from './useOnboarding'

const KEY = 'test.onboarded'
const STEPS: CoachStep[] = Array.from({ length: 4 }, (_, index) => ({
  target: `#target-${index}`,
  title: `Card ${index + 1}`,
  body: `Description ${index + 1}`,
  placement: 'left-center'
}))

describe('useOnboarding', () => {
  beforeEach(() => window.localStorage.clear())

  it('advances in order and persists completion only after the final card', async () => {
    const tour = useOnboarding(STEPS, KEY)
    for (const [index, step] of STEPS.entries()) {
      expect(tour.active.value).toBe(true)
      expect(tour.index.value).toBe(index)
      expect(tour.step.value).toEqual(step)
      expect(tour.isLast.value).toBe(index === STEPS.length - 1)
      await nextTick()
      expect(localStorage.getItem(KEY)).toBe('false')
      tour.next()
    }
    expect(tour.active.value).toBe(false)
    await nextTick()
    expect(localStorage.getItem(KEY)).toBe('true')
    expect(useOnboarding(STEPS, KEY).active.value).toBe(false)
  })

  it.for([0, 1, 2, 3])(
    'can dismiss from card index %i without advancing further',
    async (index) => {
      const tour = useOnboarding(STEPS, KEY)
      for (let i = 0; i < index; i++) tour.next()
      tour.finish()
      tour.next()
      expect(tour.active.value).toBe(false)
      expect(tour.index.value).toBe(index)
      await nextTick()
      expect(useOnboarding(STEPS, KEY).active.value).toBe(false)
    }
  )

  it('starts again at the first card after an unfinished tour remounts', async () => {
    useOnboarding(STEPS, KEY).next()
    await nextTick()
    const resumed = useOnboarding(STEPS, KEY)
    expect(resumed.active.value).toBe(true)
    expect(resumed.step.value).toEqual(STEPS[0])
  })

  it('honors the existing default completion key', () => {
    localStorage.setItem('Comfy.AgentPanel.onboarded', 'true')
    const tour = useOnboarding(STEPS)
    expect(tour.active.value).toBe(false)
    tour.next()
    expect(tour.index.value).toBe(0)
  })

  it('reflects translated step updates without resetting progress', () => {
    const steps = ref(STEPS)
    const tour = useOnboarding(steps, KEY)
    tour.next()
    steps.value = STEPS.map((step) => ({
      ...step,
      title: `Translated ${step.title}`
    }))
    expect(tour.index.value).toBe(1)
    expect(tour.step.value.title).toBe('Translated Card 2')
  })

  it('does not complete when there are no cards', () => {
    const tour = useOnboarding([], KEY)
    tour.next()
    expect(tour.active.value).toBe(false)
    expect(localStorage.getItem(KEY)).toBe('false')
  })
})
