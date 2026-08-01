import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import SubscriptionPaymentDeclinedWorkspace from './SubscriptionPaymentDeclinedWorkspace.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: { back: 'Back' },
      subscription: {
        preview: {
          paymentDeclinedTitle: 'Payment declined',
          paymentDeclinedDescription:
            "Your card couldn't be charged. Try another card, or contact your bank if this looks wrong.",
          stripeReasoning: 'Stripe reasoning:',
          updatePaymentMethod: 'Update payment method'
        }
      }
    }
  }
})

function renderComponent(reason: string | null = null) {
  return render(SubscriptionPaymentDeclinedWorkspace, {
    props: { reason },
    global: { plugins: [i18n] }
  })
}

describe('SubscriptionPaymentDeclinedWorkspace', () => {
  it('renders the declined copy and hides the reason tile without a reason', () => {
    renderComponent()

    expect(screen.getByText('Payment declined')).toBeInTheDocument()
    expect(screen.queryByText('Stripe reasoning:')).not.toBeInTheDocument()
  })

  it('shows the failure reason when provided', () => {
    renderComponent('Insufficient funds')

    expect(screen.getByText('Stripe reasoning:')).toBeInTheDocument()
    expect(screen.getByText('Insufficient funds')).toBeInTheDocument()
  })

  it('emits back and updatePayment from their controls', async () => {
    const user = userEvent.setup()
    const { emitted } = renderComponent()

    await user.click(screen.getByRole('button', { name: 'Back' }))
    await user.click(
      screen.getByRole('button', { name: 'Update payment method' })
    )

    expect(emitted().back).toBeTruthy()
    expect(emitted().updatePayment).toBeTruthy()
  })
})
