import { cleanup, render, screen } from '@testing-library/vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import TourSpotlight from './TourSpotlight.vue'
import type { CoachStep } from './onboardingTours'

vi.mock('@primeuix/utils/zindex', () => ({
  ZIndex: { set: vi.fn(), clear: vi.fn() }
}))

const mocks = vi.hoisted(() => ({
  targetMoving: null as unknown as { value: boolean }
}))

vi.mock('./useCoachmarkTarget', async () => {
  const { computed, ref } = await import('vue')
  mocks.targetMoving = ref(false)
  return {
    useCoachmarkTarget: () => ({
      targetEl: computed(() => document.body),
      targetRect: computed(() => new DOMRect(100, 100, 200, 80)),
      floatingStyles: ref({ position: 'fixed', left: '0px', top: '0px' }),
      isPositioned: ref(true),
      targetMoving: mocks.targetMoving
    })
  }
})

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

const step: CoachStep = { name: 'run', placement: 'right' }

describe('TourSpotlight motion', () => {
  afterEach(cleanup)

  it('rides a moving target without transitions and glides once it rests', async () => {
    mocks.targetMoving.value = false
    render(TourSpotlight, {
      props: {
        step,
        title: 'Run your app',
        body: 'Press to run',
        isLast: false,
        canGoBack: false,
        primaryLabel: 'Next',
        skipLabel: 'Skip',
        backLabel: 'Back',
        countedStepIdx: 0,
        countedStepsTotal: 1,
        waitingForTarget: false
      },
      global: { plugins: [i18n] }
    })
    const ring = screen.getByTestId('coach-spotlight')
    const card = screen.getByRole('dialog', { name: 'Run your app' })
    expect(ring.className).toContain('motion-safe:transition-')
    expect(card.className).toContain('motion-safe:transition-')

    mocks.targetMoving.value = true
    await nextTick()
    expect(ring.className).not.toContain('motion-safe:transition-')
    expect(card.className).not.toContain('motion-safe:transition-')

    mocks.targetMoving.value = false
    await nextTick()
    expect(ring.className).toContain('motion-safe:transition-')
    expect(card.className).toContain('motion-safe:transition-')
  })
})
