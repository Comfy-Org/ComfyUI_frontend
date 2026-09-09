import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/i18n'
import type { CoachStep } from '../../composables/agent/useOnboarding'

import OnboardingCoach from './OnboardingCoach.vue'

const STEP: CoachStep = {
  target: '#coach-target',
  title: 'Meet the agent',
  body: 'Ask it to build or edit graphs.'
}

let target: HTMLElement | undefined

function mountWithTarget(rect: { left: number; top: number }) {
  target = document.createElement('div')
  target.id = 'coach-target'
  target.getBoundingClientRect = vi.fn(() => ({
    left: rect.left,
    top: rect.top,
    right: rect.left + 400,
    bottom: 800,
    width: 400,
    height: 700,
    x: rect.left,
    y: rect.top,
    toJSON: () => ({})
  }))
  document.body.appendChild(target)
  return render(OnboardingCoach, {
    props: { step: STEP, storageKey: `coach-${Math.random()}` },
    global: { plugins: [i18n] }
  })
}

describe('OnboardingCoach', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    target?.remove()
    localStorage.clear()
  })

  it('places the card fully left of the docked panel', async () => {
    mountWithTarget({ left: 700, top: 100 })

    const dialog = await screen.findByRole('dialog', {
      name: 'Meet the agent'
    })
    // eslint-disable-next-line testing-library/no-node-access -- position lands on the styled child
    const card = dialog.querySelector('[style]') as HTMLElement
    const left = Number.parseFloat(card.style.left)
    const renderedWidth = Number.parseFloat(getComputedStyle(card).width)
    expect(renderedWidth).toBe(256)
    expect(left + renderedWidth).toBeLessThanOrEqual(700 - 8)
    expect(left).toBeGreaterThanOrEqual(8)
    // Anchored near the panel's top, not its bottom edge.
    expect(Number.parseFloat(card.style.top)).toBe(108)
  })

  it('repositions when the viewport narrows after mount', async () => {
    // 1280px viewport, target left edge at x=900 (mirrors the mr2-4 T-24/
    // T-25 repro shape: a docked panel/target whose unclamped card position
    // is in-bounds at the wide viewport but must re-clamp once narrowed).
    // At 1280px: 900 - 256 - 8 = 636, within [8, 1280-264]=[8,1016] --
    // unclamped. At 700px: the same 636 would exceed 700-264=436, so the
    // card must re-clamp to 436, a genuinely different value from 636.
    window.innerWidth = 1280
    window.innerHeight = 800
    mountWithTarget({ left: 900, top: 100 })

    function getCard(): HTMLElement {
      const dialog = screen.getByRole('dialog', { name: 'Meet the agent' })
      // eslint-disable-next-line testing-library/no-node-access -- position lands on the styled child
      return dialog.querySelector('[style]') as HTMLElement
    }

    await screen.findByRole('dialog', { name: 'Meet the agent' })
    const renderedWidth = Number.parseFloat(getComputedStyle(getCard()).width)
    const initialLeft = Number.parseFloat(getCard().style.left)
    expect(initialLeft).toBe(636)

    // Narrow the viewport (e.g. panel resize) without remounting or moving
    // the target. `useWindowSize` fires a real resize listener; the card
    // must re-clamp into the new, narrower viewport.
    window.innerWidth = 700
    window.dispatchEvent(new Event('resize'))
    // The suite runs under global fake timers (vitest.timer.setup.ts); a
    // plain `nextTick()` only drains microtasks, not the fake-timer queue,
    // so the position watcher's `await nextTick()` step needs an explicit
    // timer flush to actually run.
    await vi.advanceTimersByTimeAsync(0)

    const left = Number.parseFloat(getCard().style.left)
    // The card must re-clamp into the narrowed viewport (436), not retain
    // its stale 1280px-viewport position (636, which would place its right
    // edge past the new 700px edge and behind the docked panel).
    expect(left + renderedWidth).toBeLessThanOrEqual(700 - 8)
    expect(left).toBeGreaterThanOrEqual(8)
    expect(left).toBe(436)
    expect(left).not.toBe(initialLeft)
  })

  it('finds a target mounted in the same render', async () => {
    render(
      {
        components: { OnboardingCoach },
        setup: () => ({ step: STEP }),
        template:
          '<div id="coach-target" /><OnboardingCoach :step="step" storage-key="coach-same-render" />'
      },
      { global: { plugins: [i18n] } }
    )

    expect(
      await screen.findByRole('dialog', { name: 'Meet the agent' })
    ).toBeInTheDocument()
  })

  it('shows one Got it action, no Skip action, and dismisses onboarding', async () => {
    mountWithTarget({ left: 700, top: 100 })

    expect(
      await screen.findByRole('button', { name: 'Got it' })
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Skip' })).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'Got it' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
