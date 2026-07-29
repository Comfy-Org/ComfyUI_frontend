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

  it('covers the viewport with an evenodd region, so its holes pass input through', () => {
    renderSpotlight({ step: spotlightStep({ interactive: true }) })

    const region = screen.getByTestId('coach-hit-region')
    expect(region.getAttribute('fill-rule')).toBe('evenodd')
    expect(region.getAttribute('d')).toBe('M0 0H1024V768H0Z')
  })

  it('still skips on Escape during an interactive step', async () => {
    const user = userEvent.setup()
    const { emitted } = renderSpotlight({
      step: spotlightStep({ interactive: true })
    })
    await user.keyboard('{Escape}')
    expect(emitted().skip).toHaveLength(1)
  })

  it('transitions the ring between DOM targets, which move on discrete events', () => {
    const el = document.createElement('div')
    el.getBoundingClientRect = () => new DOMRect(10, 10, 80, 40)
    document.body.append(el)
    registerCoachmark(COACH_IDS.inputsList, el)

    renderSpotlight({
      step: spotlightStep({ coachId: COACH_IDS.inputsList })
    })

    expect(screen.getByTestId('coach-spotlight').className).toContain(
      'transition-[left,top,width,height,opacity]'
    )
  })

  it('rides a node the camera carries instead of transitioning after it', () => {
    const node = document.createElement('div')
    node.setAttribute('data-node-id', '7')
    node.getBoundingClientRect = () => new DOMRect(10, 10, 80, 40)
    document.body.append(node)
    registerCoachmark(COACH_IDS.inputsList, {
      selector: '[data-node-id="7"]',
      onMove: () => () => {}
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
