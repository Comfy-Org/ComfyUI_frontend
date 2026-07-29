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
import type { CoachTarget } from './coachmarkRegistry'
import { COACH_IDS, FIRST_RUN_COACH_IDS } from './onboardingTours'
import type { CoachStep } from './onboardingTours'

vi.mock('@primeuix/utils/zindex', () => ({
  ZIndex: { set: vi.fn(), clear: vi.fn() }
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

/** Mounts a canvas node and returns the target that names it. */
function canvasNode(): CoachTarget {
  const node = document.createElement('div')
  node.setAttribute('data-node-id', '7')
  node.getBoundingClientRect = () => new DOMRect(10, 10, 80, 40)
  document.body.append(node)
  return { selector: '[data-node-id="7"]', onMove: () => () => {} }
}

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
    registerCoachmark(COACH_IDS.inputsList, canvasNode())

    renderSpotlight({
      step: spotlightStep({ coachId: COACH_IDS.inputsList })
    })

    expect(
      screen.getByTestId('coach-spotlight').className,
      'a transition makes the ring lag a target that moves every frame'
    ).not.toContain('transition-[left,top,width,height,opacity]')
  })

  it('holds the opening card back until its tour has framed itself', () => {
    renderSpotlight({ opening: true })
    const card = screen.getByRole('dialog', { hidden: true })

    expect(
      card.style.opacity,
      'the first card has nowhere to travel from, so it fades in once the view is still'
    ).toBe('0')
    expect(
      card.className,
      'a hidden card must not swallow clicks meant for the app'
    ).toContain('pointer-events-none')
    expect(
      card.className,
      'a card that pops in reads as a glitch rather than an arrival'
    ).toContain('transition')
  })

  it('keeps the card on screen once the tour is under way', async () => {
    const { rerender } = renderSpotlight({ opening: true })

    await rerender({ opening: false, step: spotlightStep({ name: 'later' }) })

    expect(
      screen.getByRole('dialog').style.opacity,
      'a card that fades out on every step reads as a restart, not a next step'
    ).toBe('1')
  })

  it('glides to a new canvas target, then rides it', async () => {
    vi.useFakeTimers()
    registerCoachmark(FIRST_RUN_COACH_IDS.prompt, canvasNode())

    renderSpotlight({
      step: spotlightStep({ coachId: FIRST_RUN_COACH_IDS.prompt })
    })
    const card = () => screen.getByRole('dialog', { hidden: true }).className

    expect(
      card(),
      'a card that jumps to the next node leaves the user hunting for it'
    ).toContain('transition-[left,top,opacity]')

    vi.advanceTimersByTime(CARD_GLIDE_MS)
    await nextTick()
    expect(
      card(),
      'transitioning after a camera that moves every frame leaves the card lagging it'
    ).not.toContain('transition-[left,top,opacity]')
  })

  it('spins while the app is still working on what the step asked for', async () => {
    let working = true
    const { rerender } = renderSpotlight({
      step: spotlightStep({ busy: () => working })
    })

    expect(
      screen.getByTestId('coach-busy'),
      'a card that reads the same whether a job is running or stalled says nothing'
    ).toBeTruthy()

    working = false
    await rerender({ step: spotlightStep({ busy: () => working }) })
    expect(screen.queryByTestId('coach-busy')).toBeNull()
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
