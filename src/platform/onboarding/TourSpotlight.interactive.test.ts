import userEvent from '@testing-library/user-event'
import { cleanup, render, screen } from '@testing-library/vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ComponentProps } from 'vue-component-type-helpers'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import TourSpotlight from './TourSpotlight.vue'
import { clearCoachmarks, registerCoachmark } from './coachmarkRegistry'
import { laidOut, mountNode, movingTarget } from './fixtures/coachmarkTargets'
import { COACH_IDS } from './onboardingTours'
import type { SpotlightStep } from './onboardingTours'

vi.mock('@primeuix/utils/zindex', () => ({
  ZIndex: { set: vi.fn(), clear: vi.fn() }
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

function spotlightStep(overrides: Partial<SpotlightStep> = {}): SpotlightStep {
  return { kind: 'spotlight', name: 'step', placement: 'right', ...overrides }
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

  it('renders the hit region evenodd, so a hole in it can pass input through', () => {
    renderSpotlight({ step: spotlightStep({ interactive: true }) })

    expect(
      screen.getByTestId('coach-hit-region').getAttribute('fill-rule'),
      'without evenodd the second subpath adds to the region instead of cutting it'
    ).toBe('evenodd')
  })

  it('drops the modal claim on an interactive step, so keybindings still fire', () => {
    renderSpotlight({ step: spotlightStep({ interactive: true }) })

    expect(
      screen.getByRole('dialog').getAttribute('aria-modal'),
      'keybindingService drops every keybinding while an aria-modal dialog is up'
    ).toBe('false')
  })

  it('keeps the modal claim on a step that does block the app', () => {
    renderSpotlight()

    expect(screen.getByRole('dialog').getAttribute('aria-modal')).toBe('true')
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
    const el = laidOut(new DOMRect(10, 10, 80, 40))
    document.body.append(el)
    registerCoachmark(COACH_IDS.inputsList, el)

    renderSpotlight({
      step: spotlightStep({ coachId: COACH_IDS.inputsList })
    })

    expect(screen.getByTestId('coach-spotlight').className).toContain(
      'motion-safe:transition-[left,top,width,height,opacity]'
    )
  })

  it('rides a node the camera carries instead of transitioning after it', () => {
    mountNode()
    registerCoachmark(COACH_IDS.inputsList, movingTarget())

    renderSpotlight({
      step: spotlightStep({ coachId: COACH_IDS.inputsList })
    })

    expect(
      screen.getByTestId('coach-spotlight').className,
      'a transition makes the ring lag a target that moves every frame'
    ).not.toContain('transition-[left,top,width,height,opacity]')
  })
})
