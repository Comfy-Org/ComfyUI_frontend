import userEvent from '@testing-library/user-event'
import { cleanup, render, screen } from '@testing-library/vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import type { ComponentProps } from 'vue-component-type-helpers'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import TourSpotlight from './TourSpotlight.vue'
import { CARD_GLIDE_MS } from './coachmarkLayout'
import { clearCoachmarks, registerCoachmark } from './coachmarkRegistry'
import { laidOut, mountNode, movingTarget } from './fixtures/coachmarkTargets'
import { COACH_IDS, FIRST_RUN_COACH_IDS } from './onboardingTours'
import type { SpotlightStep } from './onboardingTours'

vi.mock('@primeuix/utils/zindex', () => ({
  ZIndex: { set: vi.fn(), clear: vi.fn() }
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

/** Mounts a canvas node and returns the target that reports its rect. */
function canvasNode() {
  mountNode()
  return movingTarget()
}

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
    vi.useRealTimers()
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
    registerCoachmark(COACH_IDS.inputsList, canvasNode())

    renderSpotlight({
      step: spotlightStep({ coachId: COACH_IDS.inputsList })
    })

    expect(
      screen.getByTestId('coach-spotlight').className,
      'a transition makes the ring lag a target that moves every frame'
    ).not.toContain('transition-[left,top,width,height,opacity]')
  })

  it('holds a card back until Floating UI has sited it against its target', () => {
    registerCoachmark(COACH_IDS.inputsList, canvasNode())
    renderSpotlight({ step: spotlightStep({ coachId: COACH_IDS.inputsList }) })
    const card = screen.getByRole('dialog', { hidden: true })

    expect(
      card.style.opacity,
      'a card shown before it is placed appears in the wrong spot, then jumps'
    ).toBe('0')
    expect(
      card.className,
      'a hidden card must not swallow clicks meant for the app'
    ).toContain('pointer-events-none')
  })

  it('shows a targetless card straight away, having nowhere to be placed', () => {
    renderSpotlight()

    expect(screen.getByRole('dialog').style.opacity).toBe('1')
  })

  it('sites the first card rather than travelling to it', () => {
    registerCoachmark(FIRST_RUN_COACH_IDS.prompt, canvasNode())

    renderSpotlight({
      step: spotlightStep({ coachId: FIRST_RUN_COACH_IDS.prompt })
    })

    expect(
      screen.getByRole('dialog', { hidden: true }).className,
      'Floating UI sites a card from the viewport origin, so travelling to the first one slides it in from the corner'
    ).not.toContain('transition-[left,top,opacity]')
  })

  it('glides to the next step’s target, then rides it', async () => {
    vi.useFakeTimers()
    registerCoachmark(FIRST_RUN_COACH_IDS.prompt, canvasNode())
    const { rerender } = renderSpotlight({
      step: spotlightStep({ coachId: FIRST_RUN_COACH_IDS.prompt })
    })
    const card = () => screen.getByRole('dialog', { hidden: true }).className

    await rerender({
      step: spotlightStep({
        name: 'later',
        coachId: FIRST_RUN_COACH_IDS.prompt
      })
    })

    expect(
      card(),
      'a card that jumps to the next node leaves the user hunting for it'
    ).toContain('motion-safe:transition-[left,top,opacity]')

    vi.advanceTimersByTime(CARD_GLIDE_MS)
    await nextTick()
    expect(
      card(),
      'transitioning after a camera that moves every frame leaves the card lagging it'
    ).not.toContain('transition-[left,top,opacity]')
  })

  it('rides a canvas target that arrives after its step opened', async () => {
    vi.useFakeTimers()
    renderSpotlight({
      step: spotlightStep({ coachId: FIRST_RUN_COACH_IDS.prompt })
    })
    const card = () => screen.getByRole('dialog', { hidden: true }).className

    registerCoachmark(FIRST_RUN_COACH_IDS.prompt, canvasNode())
    await nextTick()

    expect(
      card(),
      'the card has to travel to the node that just arrived, not jump to it'
    ).toContain('motion-safe:transition-[left,top,opacity]')

    vi.advanceTimersByTime(CARD_GLIDE_MS)
    await nextTick()
    expect(
      card(),
      'a card that never stops transitioning trails the node it is riding'
    ).not.toContain('transition-[left,top,opacity]')
  })

  it('keeps focus inside the card on a step with no primary button', async () => {
    renderSpotlight({
      step: spotlightStep({ selfAdvancing: true, interactive: true })
    })
    await nextTick()
    await nextTick()

    expect(
      screen.queryByRole('button', { name: 'Next' }),
      'a self-advancing step is passed by doing the thing, so it offers no Next'
    ).toBeNull()
    expect(
      screen.getByRole('button', { name: 'Skip' }),
      'focus on <body> makes a keyboard user tab from the top of the document'
    ).toHaveFocus()
  })

  it('points a cursor back at the target from the card edge facing it', async () => {
    registerCoachmark(FIRST_RUN_COACH_IDS.prompt, canvasNode())

    const { rerender } = renderSpotlight({
      step: spotlightStep({ coachId: FIRST_RUN_COACH_IDS.prompt, cursor: true })
    })
    expect(
      screen.getByTestId('coach-cursor').className,
      'the card sits right of the target, so the cursor must ride its left edge'
    ).toContain('-left-7')

    await rerender({
      step: spotlightStep({ coachId: FIRST_RUN_COACH_IDS.prompt })
    })
    expect(
      screen.queryByTestId('coach-cursor'),
      'a step that did not ask for a cursor must not grow one'
    ).toBeNull()
  })
})
