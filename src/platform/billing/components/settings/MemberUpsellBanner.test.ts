import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'

import MemberUpsellBanner from './MemberUpsellBanner.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

function renderBanner() {
  return render(MemberUpsellBanner, {
    global: { plugins: [i18n] }
  })
}

describe('MemberUpsellBanner', () => {
  it('pitches the Team plan', () => {
    renderBanner()

    expect(
      screen.getByText('To add teammates, upgrade your plan.')
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Upgrade to Team' })
    ).toBeInTheDocument()
  })

  it('emits action when the CTA is clicked', async () => {
    const user = userEvent.setup()
    const { emitted } = renderBanner()

    await user.click(screen.getByRole('button', { name: 'Upgrade to Team' }))

    expect(emitted()).toHaveProperty('action')
  })
})
