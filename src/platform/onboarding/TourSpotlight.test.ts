import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { nextTick, ref } from 'vue'
import { createI18n } from 'vue-i18n'
import type { ComponentProps } from 'vue-component-type-helpers'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { clearCoachmarks } from './coachmarkRegistry'
import TourSpotlight from './TourSpotlight.vue'
import type { SpotlightStep } from './onboardingTours'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

function spotlightStep(overrides: Partial<SpotlightStep> = {}): SpotlightStep {
  return { kind: 'spotlight', name: 'run', placement: 'right', ...overrides }
}

const baseProps = {
  title: 'Run your app',
  body: 'Press to run',
  isLast: false,
  canGoBack: false,
  primaryLabel: 'Next',
  skipLabel: 'Skip',
  backLabel: 'Back',
  countedStepIdx: 0,
  countedStepsTotal: 1,
  waitingForTarget: false,
  stepSettled: true
}

function renderSpotlight(
  props: Partial<ComponentProps<typeof TourSpotlight>> = {}
) {
  return render(TourSpotlight, {
    props: { step: spotlightStep(), ...baseProps, ...props },
    global: { plugins: [i18n] }
  })
}

describe('TourSpotlight', () => {
  afterEach(() => {
    clearCoachmarks()
  })

  it('renders the spotlight and card for a step', () => {
    renderSpotlight()
    expect(screen.getByTestId('coach-spotlight')).toBeTruthy()
    expect(screen.getByRole('dialog', { name: 'Run your app' })).toBeTruthy()
    expect(screen.getByText('Press to run')).toBeTruthy()
    expect(screen.getByText('Step 1 of 1')).toBeTruthy()
  })

  it('hides the Skip button on the last step', () => {
    renderSpotlight({ isLast: true })
    expect(screen.queryByRole('button', { name: 'Skip' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Next' })).toBeTruthy()
  })

  it('shows Back and emits back when there is a previous step', async () => {
    const user = userEvent.setup()
    const { emitted } = renderSpotlight({ canGoBack: true })
    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(emitted().back).toHaveLength(1)
  })

  it('hides Back on the first step', () => {
    renderSpotlight({ canGoBack: false })
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull()
  })

  it('removes the tour overlay on unmount', async () => {
    const { unmount } = renderSpotlight()
    await nextTick()
    await nextTick()
    expect(screen.getByTestId('coach-overlay')).toBeVisible()

    unmount()
    expect(screen.queryByTestId('coach-overlay')).not.toBeInTheDocument()
  })

  it('keeps the tour tier when a later overlay opens and the step changes', async () => {
    const { rerender, unmount } = renderSpotlight()
    await nextTick()
    await nextTick()
    render({
      template:
        '<section class="fixed z-overlay" data-testid="existing-overlay" />'
    })
    const laterLayer = screen.getByTestId('existing-overlay')

    await rerender({ step: spotlightStep({ placement: 'left' }) })
    await nextTick()
    await nextTick()
    expect(screen.getByTestId('coach-overlay')).toHaveClass('z-tour')

    unmount()
    expect(laterLayer).toBeInTheDocument()
  })

  it('leaves focus, z-order and travel alone when a step renames itself', async () => {
    const runState = ref('generating')
    const step: SpotlightStep = {
      kind: 'spotlight',
      placement: 'right',
      get name() {
        return runState.value === 'generating'
          ? 'result.generating'
          : 'result.image'
      }
    }
    const { rerender } = renderSpotlight({
      step,
      title: 'Hang tight',
      body: 'Your result lands here'
    })
    await nextTick()
    await nextTick()

    const skip = screen.getByRole('button', { name: 'Skip' })
    skip.focus()
    render({
      template:
        '<section class="fixed z-overlay" data-testid="existing-overlay" />'
    })
    const travel = screen.getByTestId('coach-card').className

    runState.value = 'succeeded'
    await nextTick()
    await nextTick()
    await rerender({ step, title: 'Your image is ready', body: 'Here it is' })
    await nextTick()
    await nextTick()

    expect(step.name, 'the step really did rename itself').toBe('result.image')
    expect(
      skip,
      'a step renaming itself mid-run must not pull focus off what the user selected'
    ).toHaveFocus()
    expect(screen.getByTestId('coach-overlay')).toHaveClass('z-tour')
    expect(
      screen.getByTestId('coach-card').className,
      'a rename is not a move, so the card must not re-arm its travel'
    ).toBe(travel)
  })

  it('emits advance on the primary button and skip on the secondary', async () => {
    const user = userEvent.setup()
    const { emitted } = renderSpotlight()

    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(emitted().advance).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: 'Skip' }))
    expect(emitted().skip).toHaveLength(1)
  })

  it('emits skip when Escape is pressed', async () => {
    const user = userEvent.setup()
    const { emitted } = renderSpotlight()

    await user.keyboard('{Escape}')
    expect(emitted().skip).toHaveLength(1)
  })

  it('disables the primary button while waiting for a deferred target', () => {
    renderSpotlight({ waitingForTarget: true })
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
  })

  it('hides the spotlight and dims via the blocker for a step with no target', () => {
    renderSpotlight({ step: spotlightStep({ placement: 'center' }) })
    expect(screen.getByTestId('coach-spotlight').style.opacity).toBe('0')
  })
})
