import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'

import SubscriptionProcessingErrorWorkspace from './SubscriptionProcessingErrorWorkspace.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

describe('SubscriptionProcessingErrorWorkspace', () => {
  it('states the card is fine and offers only a retry', async () => {
    const { emitted } = render(SubscriptionProcessingErrorWorkspace, {
      global: { plugins: [i18n] }
    })

    expect(
      screen.getByText("Payment couldn't be processed")
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Nothing is wrong with your card/)
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Update payment method' })
    ).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(emitted().tryAgain).toBeTruthy()
  })
})
