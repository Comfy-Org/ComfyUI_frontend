import { cleanup, render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'
import type { ComponentProps } from 'vue-component-type-helpers'

import { clearCoachmarks, registerCoachmark } from './coachmarkRegistry'
import TourSpotlight from './TourSpotlight.vue'
import type { CoachId, CoachStep } from './onboardingTours'

vi.mock('@primeuix/utils/zindex', () => ({
  ZIndex: { set: vi.fn(), clear: vi.fn() }
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: { close: 'Close' },
      tt: 'Run your app',
      bb: 'Press to run',
      onboardingCoachmarks: { stepLabel: 'Step {current} of {total}' }
    }
  }
})

function spotlightStep(overrides: Partial<CoachStep> = {}): CoachStep {
  return { titleKey: 'tt', bodyKey: 'bb', placement: 'right', ...overrides }
}

const baseProps = {
  isLast: false,
  primaryLabel: 'Next',
  skipLabel: 'Skip',
  countedStepIdx: 0,
  countedStepsTotal: 1,
  suspendFocusGuard: false
}

function renderSpotlight(
  props: Partial<ComponentProps<typeof TourSpotlight>> = {}
) {
  return render(TourSpotlight, {
    props: { step: spotlightStep(), ...baseProps, ...props },
    global: { plugins: [i18n] }
  })
}

/** Register a laid-out target for an id so the spotlight resolves its rect. */
function mountTarget(id: CoachId): HTMLElement {
  const el = document.createElement('button')
  el.getBoundingClientRect = () => new DOMRect(10, 10, 80, 30)
  document.body.appendChild(el)
  registerCoachmark(id, el)
  return el
}

describe('TourSpotlight', () => {
  afterEach(() => {
    cleanup()
    clearCoachmarks()
    document.body.replaceChildren()
    vi.useRealTimers()
  })

  it('renders the spotlight and card for a step', () => {
    renderSpotlight()
    expect(screen.getByTestId('coach-spotlight')).toBeTruthy()
    const card = screen.getByRole('dialog')
    expect(card).toHaveAttribute('aria-label', 'Run your app')
    expect(screen.getByText('Press to run')).toBeTruthy()
    expect(screen.getByText('Step 1 of 1')).toBeTruthy()
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

  it('hides the primary button on a click-to-advance step', () => {
    renderSpotlight({
      step: spotlightStep({
        advanceOnTargetClick: true,
        coachId: 'assets-button'
      })
    })
    expect(screen.queryByRole('button', { name: 'Next' })).toBeNull()
  })

  it('emits advance when the spotlighted target is clicked', async () => {
    const user = userEvent.setup()
    const target = mountTarget('assets-button')
    const { emitted } = renderSpotlight({
      step: spotlightStep({
        advanceOnTargetClick: true,
        coachId: 'assets-button'
      })
    })

    await user.click(target)
    expect(emitted().advance).toHaveLength(1)
  })

  it('pulses the outline after the user stalls on a click-to-advance step', async () => {
    vi.useFakeTimers()
    renderSpotlight({
      step: spotlightStep({
        advanceOnTargetClick: true,
        coachId: 'assets-button'
      })
    })

    expect(
      screen.getByTestId('coach-spotlight').getAttribute('class')
    ).not.toMatch(/coach-pulse/)
    await vi.advanceTimersByTimeAsync(4000)
    expect(screen.getByTestId('coach-spotlight').getAttribute('class')).toMatch(
      /coach-pulse/
    )
  })

  it('hides the spotlight and dims via the blocker for a step with no target', () => {
    renderSpotlight({ step: spotlightStep({ placement: 'center' }) })
    expect(screen.getByTestId('coach-spotlight').style.opacity).toBe('0')
  })
})
