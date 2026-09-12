import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'

import EmbeddedCheckout from '@/components/EmbeddedCheckout.vue'
import { createBillingI18n } from '@/i18n'

const checkoutProps = {
  planName: 'Creator',
  monthlyPriceCents: 2800,
  amountDueCents: 33_600,
  creditsPerMonth: 6900,
  billingCycle: 'yearly' as const
}

describe('EmbeddedCheckout', () => {
  it('returns the payment confirmation to the SDK adapter', async () => {
    const onConfirm = vi.fn()

    render(EmbeddedCheckout, {
      props: { ...checkoutProps, checkoutEnabled: true, onConfirm },
      global: { plugins: [createBillingI18n()] }
    })

    expect(screen.getByText('$336 billed yearly')).toBeInTheDocument()
    expect(screen.getByText('6,900')).toBeInTheDocument()
    await userEvent.click(
      screen.getByRole('button', { name: 'Pay and subscribe' })
    )
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('renders the completed checkout state', () => {
    render(EmbeddedCheckout, {
      props: { ...checkoutProps, phase: 'success' },
      global: { plugins: [createBillingI18n()] }
    })

    expect(
      screen.getByRole('heading', { name: "You're all set" })
    ).toBeInTheDocument()
    expect(screen.getByText('Creator')).toBeInTheDocument()
  })
})
