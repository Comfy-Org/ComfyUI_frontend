import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'

import SubscriptionDeclinedWorkspace from './SubscriptionDeclinedWorkspace.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

function renderDeclined(declineReason: string | null = null) {
  return render(SubscriptionDeclinedWorkspace, {
    props: { declineReason },
    global: { plugins: [i18n] }
  })
}

describe('SubscriptionDeclinedWorkspace', () => {
  it('shows the Stripe reason when the API provides one', () => {
    renderDeclined('Insufficient funds')

    expect(screen.getByText('What your bank said')).toBeInTheDocument()
    expect(screen.getByText('Insufficient funds')).toBeInTheDocument()
  })

  it('omits the reason block entirely when there is none', () => {
    renderDeclined(null)

    expect(screen.queryByText('What your bank said')).toBeNull()
    expect(screen.getByText('Payment declined')).toBeInTheDocument()
  })

  it('offers a retry rather than ending the flow', async () => {
    const { emitted } = renderDeclined('Card declined')

    await userEvent.click(
      screen.getByRole('button', { name: 'Update payment method' })
    )
    expect(emitted().updatePayment).toBeTruthy()

    await userEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(emitted().back).toBeTruthy()
  })
})
