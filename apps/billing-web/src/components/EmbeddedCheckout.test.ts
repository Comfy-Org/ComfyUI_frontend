import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'

import EmbeddedCheckout from '@/components/EmbeddedCheckout.vue'
import { createBillingI18n } from '@/i18n'

interface CheckoutProps {
  planName: string
  priceCents: number
  amountDueCents: number
  creditsCents: number
  billingCycle: 'monthly' | 'yearly'
}

const checkoutProps: CheckoutProps = {
  planName: 'Creator',
  priceCents: 2800,
  amountDueCents: 2800,
  creditsCents: 6900,
  billingCycle: 'monthly'
}

function renderCheckout(
  props: Partial<CheckoutProps> & { phase?: 'payment' | 'success' } = {},
  handlers: { onBack?: () => void; onClose?: () => void } = {}
) {
  return render(EmbeddedCheckout, {
    props: { ...checkoutProps, ...props, ...handlers },
    slots: {
      form: '<button type="button">Provider form</button>',
      done: '<a href="/back">Back to product</a>'
    },
    global: { plugins: [createBillingI18n()] }
  })
}

describe('EmbeddedCheckout', () => {
  it('prices a monthly plan and leaves the form to the host', () => {
    renderCheckout()

    // The price and the amount due today coincide on a first month.
    expect(screen.getAllByText('$28.00')).toHaveLength(2)
    expect(screen.getByText('USD per month')).toBeInTheDocument()
    expect(screen.getByText('Billed monthly')).toBeInTheDocument()
    expect(screen.getByText('$69.00')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Provider form' })
    ).toBeInTheDocument()
  })

  it('prices a yearly plan by its period and charges the prorated amount due', () => {
    // A mid-period upgrade: the period price and the charge today differ, so a
    // swapped or duplicated binding cannot pass.
    renderCheckout({
      priceCents: 33_649,
      amountDueCents: 12_500,
      billingCycle: 'yearly'
    })

    expect(screen.getByText('$336.49')).toBeInTheDocument()
    expect(screen.getByText('USD per year')).toBeInTheDocument()
    expect(screen.getByText('$125.00 billed yearly')).toBeInTheDocument()
    expect(screen.getByText('$125.00')).toBeInTheDocument()
  })

  it('renders the completed state with the way back the host provides', () => {
    renderCheckout({ phase: 'success' })

    expect(
      screen.getByRole('heading', { name: "You're all set" })
    ).toBeInTheDocument()
    expect(screen.getByText('Creator')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Back to product' })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Provider form' })
    ).not.toBeInTheDocument()
  })

  it('hands navigation back to the host', async () => {
    const onBack = vi.fn()
    const onClose = vi.fn()
    renderCheckout({}, { onBack, onClose })

    await userEvent.click(screen.getByRole('button', { name: 'Back' }))
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(onBack).toHaveBeenCalledOnce()
    expect(onClose).toHaveBeenCalledOnce()
  })
})
