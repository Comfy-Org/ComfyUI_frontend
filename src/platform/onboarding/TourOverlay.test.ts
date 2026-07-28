import { fromPartial } from '@total-typescript/shoehorn'
import { cleanup, render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, reactive, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import TourOverlay from './TourOverlay.vue'
import type { CoachStep } from './onboardingTours'
import { useOnboardingTourStore } from './onboardingTourStore'

vi.mock('./onboardingTourStore', () => ({ useOnboardingTourStore: vi.fn() }))

function makeTourState() {
  return {
    step: ref<CoachStep | null>(null),
    title: ref('Canvas title'),
    body: ref('Canvas body'),
    isLast: ref(false),
    primaryLabel: ref('Next'),
    skipLabel: ref('Skip'),
    countedStepIdx: ref(0),
    countedStepsTotal: ref(0),
    waitingForTarget: ref(false),
    next: vi.fn(),
    skip: vi.fn()
  }
}

// Stubbed so the suite covers only TourOverlay's branching and intent wiring.
vi.mock('./TourSpotlight.vue', () => ({
  default: defineComponent({
    emits: ['advance', 'skip'],
    setup(_, { emit }) {
      return () =>
        h('div', { 'data-testid': 'spotlight' }, [
          h('button', { onClick: () => emit('advance') }, 'advance'),
          h('button', { onClick: () => emit('skip') }, 'skip')
        ])
    }
  })
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

let s: ReturnType<typeof makeTourState>

const spotlightStep: CoachStep = {
  name: 'run',
  placement: 'right'
}

function landingStep(): CoachStep {
  return { name: 'landing', placement: 'center', landing: true }
}

function renderOverlay() {
  return render(TourOverlay, { global: { plugins: [i18n] } })
}

describe('TourOverlay', () => {
  beforeEach(() => {
    s = makeTourState()
    vi.mocked(useOnboardingTourStore).mockReturnValue(fromPartial(reactive(s)))
  })

  afterEach(cleanup)

  it('renders nothing when no tour step is active', () => {
    renderOverlay()
    expect(screen.queryByTestId('spotlight')).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('renders the spotlight for a non-landing step and wires its intents', async () => {
    const user = userEvent.setup()
    s.step.value = spotlightStep
    renderOverlay()

    expect(screen.getByTestId('spotlight')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'advance' }))
    expect(s.next).toHaveBeenCalledOnce()

    await user.click(screen.getByRole('button', { name: 'skip' }))
    expect(s.skip).toHaveBeenCalledOnce()
  })

  it('renders the landing step and starts the tour on its primary action', async () => {
    const user = userEvent.setup()
    s.step.value = landingStep()
    s.primaryLabel.value = 'Start tutorial'
    renderOverlay()

    await user.click(
      await screen.findByRole('button', { name: 'Start tutorial' })
    )
    expect(s.next).toHaveBeenCalledOnce()
  })

  it('disables the landing primary action while waiting for a deferred target', async () => {
    s.step.value = landingStep()
    s.primaryLabel.value = 'Start tutorial'
    s.waitingForTarget.value = true
    renderOverlay()

    expect(
      await screen.findByRole('button', { name: 'Start tutorial' })
    ).toBeDisabled()
  })

  it('ends the tour when the landing is dismissed', async () => {
    const user = userEvent.setup()
    s.step.value = landingStep()
    renderOverlay()

    await user.click(await screen.findByRole('button', { name: 'Skip' }))
    expect(s.skip).toHaveBeenCalledOnce()
  })
})
