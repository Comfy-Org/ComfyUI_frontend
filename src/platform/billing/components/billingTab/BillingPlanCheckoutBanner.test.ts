import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'
import type { PlanCheckoutBanner } from '@/platform/billing/components/billingTab/planCheckoutBanner'

import BillingPlanCheckoutBanner from './BillingPlanCheckoutBanner.vue'

function renderBanner(banner: PlanCheckoutBanner) {
  return render(BillingPlanCheckoutBanner, {
    props: { banner },
    global: {
      plugins: [
        createI18n({
          legacy: false,
          locale: 'en',
          messages: { en: enMessages }
        })
      ]
    }
  })
}

describe('BillingPlanCheckoutBanner', () => {
  it('links the bank check when the operation serves an action url', () => {
    renderBanner({
      kind: 'verifyPayment',
      opId: 'op-1',
      actionUrl: 'https://pay.example/verify'
    })

    expect(screen.getByRole('status')).toHaveTextContent('Verify your payment')
    expect(screen.getByRole('status')).toHaveTextContent(
      'Your bank requires additional verification to complete this payment.'
    )
    expect(
      screen.getByRole('link', { name: 'Verify your payment' })
    ).toHaveAttribute('href', 'https://pay.example/verify')
  })

  it('uses the 12px banner shell with md buttons', () => {
    renderBanner({
      kind: 'verifyPayment',
      opId: 'op-1',
      actionUrl: 'https://pay.example/verify'
    })

    expect(screen.getByRole('status')).toHaveClass('rounded-xl', 'p-3')
    expect(screen.getByRole('button', { name: 'Dismiss' })).toHaveClass('h-8')
    expect(
      screen.getByRole('link', { name: 'Verify your payment' })
    ).toHaveClass('h-8')
  })

  it('shows verify payment with no link when the operation omits action_url', () => {
    renderBanner({ kind: 'verifyPayment', opId: 'op-1', actionUrl: null })

    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('shows payment received without a payment link', () => {
    renderBanner({ kind: 'paymentReceived', opId: 'op-1' })

    expect(screen.getByRole('status')).toHaveTextContent('Payment received')
    expect(screen.getByRole('status')).toHaveTextContent(
      "Your plan is activating. You won't be charged again."
    )
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('dismisses from the button', async () => {
    const { emitted } = renderBanner({
      kind: 'paymentReceived',
      opId: 'op-1'
    })

    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }))

    expect(emitted().dismiss).toHaveLength(1)
  })
})
