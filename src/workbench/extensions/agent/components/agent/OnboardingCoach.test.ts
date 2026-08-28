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
  target.getBoundingClientRect = vi.fn(
    () =>
      ({
        left: rect.left,
        top: rect.top,
        right: rect.left + 400,
        bottom: 800,
        width: 400,
        height: 700,
        x: rect.left,
        y: rect.top,
        toJSON: () => ({})
      }) as DOMRect
  )
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

  it('T-24 / PM-662 / FE-1316 keeps onboarding visible with one Got it action and no Skip', async () => {
    mountWithTarget({ left: 700, top: 100 })

    expect(
      await screen.findByRole('button', { name: 'Got it' })
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Skip' })).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'Got it' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
