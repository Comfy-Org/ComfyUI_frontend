import { cleanup, render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import type { Mock } from 'vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Ref } from 'vue'
import { createI18n } from 'vue-i18n'

import TourOverlay from './TourOverlay.vue'
import type { CoachStep } from './onboardingTours'
import type { useCoachmarkTour } from './useCoachmarkTour'

// Derived from the composable's contract so the mock can't drift: each method
// becomes a Mock and each reactive value a writable Ref (tests drive scenarios
// by setting `.value`, which the real ComputedRefs wouldn't allow).
type TourApi = ReturnType<typeof useCoachmarkTour>
type TourState = {
  [K in keyof TourApi]: TourApi[K] extends (...args: never[]) => unknown
    ? Mock
    : TourApi[K] extends { value: infer V }
      ? Ref<V>
      : never
}

// `state` is populated by the vi.mock factory below; mutated in place so the
// reference the component captured stays stable across tests.
const mocks = vi.hoisted(() => ({ state: {} as TourState }))
vi.mock('./useCoachmarkTour', async () => {
  const { ref } = await import('vue')
  Object.assign(mocks.state, {
    step: ref<CoachStep | null>(null),
    countedSteps: ref<CoachStep[]>([]),
    countedStepIdx: ref(0),
    targetRect: ref<DOMRect | null>(null),
    primaryLabel: ref('Next'),
    skipLabel: ref('Skip'),
    expectsTargetInteraction: ref(false),
    outlinePulsing: ref(false),
    showSkip: ref(true),
    onPrimary: vi.fn(),
    end: vi.fn()
  } satisfies TourState)
  return { useCoachmarkTour: () => mocks.state }
})

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: { close: 'Close' },
      tt: 'Canvas title',
      bb: 'Canvas body',
      onboardingCoachmarks: { stepLabel: 'Step {current} of {total}' }
    }
  }
})

const s = mocks.state

const spotlightStep: CoachStep = {
  titleKey: 'tt',
  bodyKey: 'bb',
  placement: 'right'
}

function renderOverlay() {
  return render(TourOverlay, { global: { plugins: [i18n] } })
}

describe('TourOverlay', () => {
  beforeEach(() => {
    s.step.value = null
    s.countedSteps.value = []
    s.countedStepIdx.value = 0
    s.targetRect.value = null
    s.primaryLabel.value = 'Next'
    s.skipLabel.value = 'Skip'
    s.expectsTargetInteraction.value = false
    s.outlinePulsing.value = false
    s.showSkip.value = true
    s.onPrimary.mockClear()
    s.end.mockClear()
  })

  afterEach(cleanup)

  it('renders nothing when no tour step is active', () => {
    renderOverlay()
    expect(screen.queryByTestId('coach-spotlight')).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('renders the spotlight, ring and card for a targeted step', () => {
    s.step.value = spotlightStep
    s.targetRect.value = new DOMRect(100, 100, 50, 40)
    s.countedSteps.value = [spotlightStep]
    renderOverlay()

    expect(screen.getByTestId('coach-spotlight')).toBeTruthy()
    expect(screen.getByTestId('coach-spotlight-ring')).toBeTruthy()
    const card = screen.getByRole('dialog')
    expect(card).toHaveAttribute('aria-label', 'Canvas title')
    expect(screen.getByText('Canvas body')).toBeTruthy()
    expect(screen.getByText('Step 1 of 1')).toBeTruthy()
  })

  it('advances on the primary button and skips on the secondary button', async () => {
    const user = userEvent.setup()
    s.step.value = spotlightStep
    s.targetRect.value = new DOMRect(100, 100, 50, 40)
    renderOverlay()

    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(s.onPrimary).toHaveBeenCalledOnce()

    await user.click(screen.getByRole('button', { name: 'Skip' }))
    expect(s.end).toHaveBeenCalledWith('skipped')
  })

  it('hides the primary button on steps the user advances by interacting with the target', () => {
    s.step.value = spotlightStep
    s.targetRect.value = new DOMRect(100, 100, 50, 40)
    s.expectsTargetInteraction.value = true
    renderOverlay()
    expect(screen.queryByRole('button', { name: 'Next' })).toBeNull()
  })

  it('animates the ring only while the outline is pulsing', () => {
    s.step.value = spotlightStep
    s.targetRect.value = new DOMRect(100, 100, 50, 40)
    s.outlinePulsing.value = true
    renderOverlay()
    expect(
      screen.getByTestId('coach-spotlight-ring').getAttribute('class')
    ).toMatch(/coach-pulse/)
  })

  it('dims via the blocker and hides the ring for a step with no target', () => {
    s.step.value = { titleKey: 'tt', bodyKey: 'bb', placement: 'center' }
    s.targetRect.value = null
    renderOverlay()
    expect(screen.getByTestId('coach-spotlight')).toBeTruthy()
    expect(screen.queryByTestId('coach-spotlight-ring')).toBeNull()
  })

  it('renders the landing step and starts the tour on its primary action', async () => {
    const user = userEvent.setup()
    s.step.value = {
      titleKey: 'tt',
      bodyKey: 'bb',
      placement: 'center',
      landing: true
    }
    s.primaryLabel.value = 'Start tutorial'
    s.skipLabel.value = 'Skip for now'
    renderOverlay()

    await user.click(
      await screen.findByRole('button', { name: 'Start tutorial' })
    )
    expect(s.onPrimary).toHaveBeenCalledOnce()
  })

  it('ends the tour when the landing is dismissed', async () => {
    const user = userEvent.setup()
    s.step.value = {
      titleKey: 'tt',
      bodyKey: 'bb',
      placement: 'center',
      landing: true
    }
    s.skipLabel.value = 'Skip for now'
    renderOverlay()

    await user.click(
      await screen.findByRole('button', { name: 'Skip for now' })
    )
    expect(s.end).toHaveBeenCalledWith('skipped')
  })
})
