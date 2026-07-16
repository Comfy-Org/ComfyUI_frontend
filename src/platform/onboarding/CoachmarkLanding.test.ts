import { cleanup, render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import CoachmarkLanding from './CoachmarkLanding.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

function renderLanding() {
  return render(CoachmarkLanding, {
    props: {
      title: 'Welcome to Apps',
      message: 'A quick tour of the essentials.',
      primaryLabel: 'Start tutorial',
      skipLabel: 'Skip',
      waitingForTarget: false
    },
    global: { plugins: [i18n] }
  })
}

describe('CoachmarkLanding', () => {
  afterEach(cleanup)

  it('renders a modal backdrop behind the landing card', async () => {
    renderLanding()
    expect(await screen.findByTestId('coach-landing-overlay')).toBeTruthy()
  })

  it('renders the title and message', async () => {
    renderLanding()
    expect(await screen.findByText('Welcome to Apps')).toBeTruthy()
    expect(screen.getByText('A quick tour of the essentials.')).toBeTruthy()
  })

  it('emits start when the primary action is clicked', async () => {
    const user = userEvent.setup()
    const { emitted } = renderLanding()
    await user.click(
      await screen.findByRole('button', { name: 'Start tutorial' })
    )
    expect(emitted().start).toHaveLength(1)
  })

  it('emits skip when Skip is clicked', async () => {
    const user = userEvent.setup()
    const { emitted } = renderLanding()
    await user.click(await screen.findByRole('button', { name: 'Skip' }))
    expect(emitted().skip).toHaveLength(1)
  })

  it('emits skip when Escape is pressed', async () => {
    const user = userEvent.setup()
    const { emitted } = renderLanding()
    await screen.findByText('Welcome to Apps')
    await user.keyboard('{Escape}')
    // The explicit listener and Reka's own dismiss may both fire here.
    expect(emitted().skip?.length).toBeGreaterThanOrEqual(1)
  })
})
