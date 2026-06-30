import { cleanup, render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import CoachmarkLanding from './CoachmarkLanding.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: { g: { close: 'Close' } } }
})

function renderLanding() {
  return render(CoachmarkLanding, {
    props: {
      open: true,
      title: 'Welcome to Apps',
      message: 'A quick tour of the essentials.',
      primaryLabel: 'Start tutorial',
      skipLabel: 'Skip for now'
    },
    global: { plugins: [i18n] }
  })
}

describe('CoachmarkLanding', () => {
  afterEach(cleanup)

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

  it('closes (open model false) when Skip is clicked', async () => {
    const user = userEvent.setup()
    const { emitted } = renderLanding()
    await user.click(
      await screen.findByRole('button', { name: 'Skip for now' })
    )
    expect(emitted()['update:open']).toEqual([[false]])
  })
})
