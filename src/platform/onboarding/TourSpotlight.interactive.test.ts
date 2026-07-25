import userEvent from '@testing-library/user-event'
import { cleanup, render, screen } from '@testing-library/vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ComponentProps } from 'vue-component-type-helpers'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import TourSpotlight from './TourSpotlight.vue'
import { clearCoachmarks, registerCoachmark } from './coachmarkRegistry'
import { COACH_IDS } from './onboardingTours'
import type { CoachStep } from './onboardingTours'

vi.mock('@primeuix/utils/zindex', () => ({
  ZIndex: { set: vi.fn(), clear: vi.fn() }
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

function spotlightStep(overrides: Partial<CoachStep> = {}): CoachStep {
  return { name: 'step', placement: 'right', ...overrides }
}

const baseProps = {
  title: 'Title',
  body: 'Body',
  isLast: false,
  canGoBack: false,
  primaryLabel: 'Next',
  skipLabel: 'Skip',
  backLabel: 'Back',
  countedStepIdx: 0,
  countedStepsTotal: 1,
  waitingForTarget: false
}

function renderSpotlight(
  props: Partial<ComponentProps<typeof TourSpotlight>> = {}
) {
  return render(TourSpotlight, {
    props: { step: spotlightStep(), ...baseProps, ...props },
    global: { plugins: [i18n] }
  })
}

describe('TourSpotlight interactive and masked steps', () => {
  afterEach(() => {
    cleanup()
    clearCoachmarks()
    document.body.replaceChildren()
  })

  it('keeps the blocking scrim and no hit region on a plain step', () => {
    renderSpotlight()
    expect(screen.getByTestId('coach-blocker')).toBeTruthy()
    expect(screen.queryByTestId('coach-hit-region')).toBeNull()
    expect(screen.queryByTestId('coach-mask-hole')).toBeNull()
  })

  it('replaces the blocker with a pass-through hit region on an interactive step', () => {
    renderSpotlight({ step: spotlightStep({ interactive: true }) })
    expect(screen.queryByTestId('coach-blocker')).toBeNull()
    expect(screen.getByTestId('coach-hit-region')).toBeTruthy()
  })

  it('cuts the extra mask rects out of the interactive hit region', () => {
    renderSpotlight({
      step: spotlightStep({
        interactive: true,
        maskRects: () => [new DOMRect(10, 10, 50, 50)]
      })
    })
    const region = screen.getByTestId('coach-hit-region')
    expect(region.getAttribute('fill-rule')).toBe('evenodd')
    expect(region.getAttribute('d')).toBe('M0 0H1024V768H0ZM6 6h58v58h-58Z')
  })

  it('renders extra mask holes while keeping the blocker on a non-interactive step', () => {
    renderSpotlight({
      step: spotlightStep({
        maskRects: () => [
          new DOMRect(10, 10, 50, 50),
          new DOMRect(100, 100, 40, 40)
        ]
      })
    })
    expect(screen.getAllByTestId('coach-mask-hole')).toHaveLength(2)
    expect(screen.getByTestId('coach-blocker')).toBeTruthy()
    expect(screen.queryByTestId('coach-hit-region')).toBeNull()
  })

  it('still skips on Escape during an interactive step', async () => {
    const user = userEvent.setup()
    const { emitted } = renderSpotlight({
      step: spotlightStep({ interactive: true })
    })
    await user.keyboard('{Escape}')
    expect(emitted().skip).toHaveLength(1)
  })

  it('rides a virtual target instead of transitioning after it', () => {
    registerCoachmark(COACH_IDS.inputsList, {
      getBoundingClientRect: () => new DOMRect(10, 10, 80, 40)
    })

    renderSpotlight({
      step: spotlightStep({ coachId: COACH_IDS.inputsList })
    })

    expect(
      screen.getByTestId('coach-spotlight').className,
      'a transition makes the ring lag a target that moves every frame'
    ).not.toContain('transition-[left,top,width,height,opacity]')
  })
})
