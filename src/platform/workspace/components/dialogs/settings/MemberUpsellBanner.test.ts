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

function renderBanner(props: { reactivate?: boolean } = {}) {
  return render(MemberUpsellBanner, {
    props,
    global: { plugins: [i18n] }
  })
}

describe('MemberUpsellBanner', () => {
  it('shows upgrade copy when the workspace never subscribed', () => {
    renderBanner()

    expect(
      screen.getByText('To add teammates, upgrade your plan.')
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Upgrade to Team' })
    ).toBeInTheDocument()
  })

  it('shows reactivate copy when the team plan has lapsed', () => {
    renderBanner({ reactivate: true })

    expect(
      screen.getByText('To add more teammates, reactivate your plan.')
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Reactivate Team' })
    ).toBeInTheDocument()
  })

  it('emits showPlans when the CTA is clicked', async () => {
    const user = userEvent.setup()
    const { emitted } = renderBanner({ reactivate: true })

    await user.click(screen.getByRole('button', { name: 'Reactivate Team' }))

    expect(emitted()).toHaveProperty('showPlans')
  })
})
