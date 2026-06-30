import { cleanup, render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import type { Mock } from 'vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
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
      isLast: makeRef(false),
      primaryLabel: makeRef('Next'),
      skipLabel: makeRef('Skip'),
      countedStepIdx: makeRef(0),
      countedSteps: makeRef<CoachStep[]>([]),
      suspendFocusGuard: makeRef(false),
      next: vi.fn(),
      end: vi.fn()
    } satisfies TourState)
)
vi.mock('./useCoachmarkTour', async () => {
  const { ref } = await import('vue')
  seedState(ref)
  return { useCoachmarkTour: () => mocks.state }
})

// Stub the spotlight so this suite covers TourOverlay's own job — branching
// between landing and spotlight and wiring their intents back to the composable.
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
  messages: {
    en: {
      g: { close: 'Close' },
      tt: 'Canvas title',
      bb: 'Canvas body'
    }
  }
})

const s = mocks.state

const spotlightStep: CoachStep = {
  titleKey: 'tt',
  bodyKey: 'bb',
  placement: 'right'
}

function landingStep(): CoachStep {
  return { titleKey: 'tt', bodyKey: 'bb', placement: 'center', landing: true }
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
    expect(s.end).toHaveBeenCalledWith('skipped')
  })

  it('renders the landing step and starts the tour on its primary action', async () => {
    const user = userEvent.setup()
    s.step.value = landingStep()
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
    s.step.value = landingStep()
    s.skipLabel.value = 'Skip for now'
    renderOverlay()

    await user.click(
      await screen.findByRole('button', { name: 'Skip for now' })
    )
    expect(s.end).toHaveBeenCalledWith('skipped')
  })
})
