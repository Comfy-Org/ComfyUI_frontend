import { cleanup, render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import type { Mock } from 'vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
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

// `state` holds the mocked composable's refs/mocks; `seedState` (re)builds it in
// one place — the factory seeds it once, and each test resets it via beforeEach.
const mocks = vi.hoisted(() => ({ state: {} as TourState }))
const seedState = vi.hoisted(
  () => (makeRef: typeof ref) =>
    Object.assign(mocks.state, {
      step: makeRef<CoachStep | null>(null),
      countedSteps: makeRef<CoachStep[]>([]),
      countedStepIdx: makeRef(0),
      targetRect: makeRef<DOMRect | null>(null),
      primaryLabel: makeRef('Next'),
      skipLabel: makeRef('Skip'),
      expectsTargetInteraction: makeRef(false),
      outlinePulsing: makeRef(false),
      showSkip: makeRef(true),
      next: vi.fn(),
      end: vi.fn()
    } satisfies TourState)
)
vi.mock('./useCoachmarkTour', async () => {
  const { ref } = await import('vue')
  seedState(ref)
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
    seedState(ref)
  })

  afterEach(cleanup)

  it('renders nothing when no tour step is active', () => {
    renderOverlay()
    expect(screen.queryByTestId('coach-spotlight')).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('renders the spotlight and card for a targeted step', () => {
    s.step.value = spotlightStep
    s.targetRect.value = new DOMRect(100, 100, 50, 40)
    s.countedSteps.value = [spotlightStep]
    renderOverlay()

    expect(screen.getByTestId('coach-spotlight')).toBeTruthy()
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
    expect(s.next).toHaveBeenCalledOnce()

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

  it('pulses the spotlight outline only while the outline is pulsing', () => {
    s.step.value = spotlightStep
    s.targetRect.value = new DOMRect(100, 100, 50, 40)
    s.outlinePulsing.value = true
    renderOverlay()
    expect(screen.getByTestId('coach-spotlight').getAttribute('class')).toMatch(
      /coach-pulse/
    )
  })

  it('hides the spotlight and dims via the blocker for a step with no target', () => {
    s.step.value = { titleKey: 'tt', bodyKey: 'bb', placement: 'center' }
    s.targetRect.value = null
    renderOverlay()
    expect(screen.getByTestId('coach-spotlight').style.opacity).toBe('0')
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
    expect(s.next).toHaveBeenCalledOnce()
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
