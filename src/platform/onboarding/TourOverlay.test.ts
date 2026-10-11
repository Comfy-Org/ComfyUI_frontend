import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import TourOverlay from './TourOverlay.vue'
import type { CoachStep } from './onboardingTours'
import { useOnboardingTourStore } from './onboardingTourStore'

// Stubbed so the suite covers only TourOverlay's branching and intent wiring.
vi.mock(import('./TourSpotlight.vue'), () => ({
  default: defineComponent({
    emits: ['advance', 'back', 'skip'],
    setup(_, { emit }) {
      return () =>
        h('div', { 'data-testid': 'spotlight' }, [
          h('button', { onClick: () => emit('advance') }, 'advance'),
          h('button', { onClick: () => emit('back') }, 'back'),
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

let s: ReturnType<typeof useOnboardingTourStore>

const spotlightStep: CoachStep = {
  kind: 'spotlight',
  name: 'run',
  placement: 'right'
}

function landingStep(): CoachStep {
  return { kind: 'landing', name: 'landing' }
}

function renderOverlay() {
  return render(TourOverlay, { global: { plugins: [i18n] } })
}

describe('TourOverlay', () => {
  beforeEach(() => {
    const store = useOnboardingTourStore()
    Object.assign(store, {
      step: null,
      title: 'Canvas title',
      body: 'Canvas body',
      isLast: false,
      canGoBack: true,
      primaryLabel: 'Next',
      skipLabel: 'Skip',
      backLabel: 'Back',
      countedStepIdx: 0,
      countedStepsTotal: 0,
      waitingForTarget: false
    })
    vi.mocked(store.next).mockResolvedValue(undefined)
    vi.mocked(store.back).mockResolvedValue(undefined)
    vi.mocked(store.skip).mockImplementation(() => undefined)
    s = store
    vi.spyOn(s, 'step', 'get').mockReturnValue(null)
    vi.spyOn(s, 'primaryLabel', 'get').mockReturnValue('Next')
    vi.spyOn(s, 'skipLabel', 'get').mockReturnValue('Skip')
  })

  it('renders nothing when no tour step is active', () => {
    renderOverlay()
    expect(screen.queryByTestId('spotlight')).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('renders the spotlight for a non-landing step and wires its intents', async () => {
    const user = userEvent.setup()
    vi.spyOn(s, 'step', 'get').mockReturnValue(spotlightStep)
    renderOverlay()

    expect(screen.getByTestId('spotlight')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'advance' }))
    expect(s.next).toHaveBeenCalledOnce()

    await user.click(screen.getByRole('button', { name: 'back' }))
    expect(s.back).toHaveBeenCalledOnce()

    await user.click(screen.getByRole('button', { name: 'skip' }))
    expect(s.skip).toHaveBeenCalledOnce()
  })

  it('renders the landing step and starts the tour on its primary action', async () => {
    const user = userEvent.setup()
    vi.spyOn(s, 'step', 'get').mockReturnValue(landingStep())
    vi.spyOn(s, 'primaryLabel', 'get').mockReturnValue('Start tutorial')
    renderOverlay()

    await user.click(
      await screen.findByRole('button', { name: 'Start tutorial' })
    )
    expect(s.next).toHaveBeenCalledOnce()
  })

  it('disables the landing primary action while waiting for a deferred target', async () => {
    vi.spyOn(s, 'step', 'get').mockReturnValue(landingStep())
    vi.spyOn(s, 'primaryLabel', 'get').mockReturnValue('Start tutorial')
    vi.spyOn(s, 'waitingForTarget', 'get').mockReturnValue(true)
    renderOverlay()

    expect(
      await screen.findByRole('button', { name: 'Start tutorial' })
    ).toBeDisabled()
  })

  it('ends the tour when the landing is dismissed', async () => {
    const user = userEvent.setup()
    vi.spyOn(s, 'step', 'get').mockReturnValue(landingStep())
    renderOverlay()

    await user.click(await screen.findByRole('button', { name: 'Skip' }))
    expect(s.skip).toHaveBeenCalledOnce()
  })
})
