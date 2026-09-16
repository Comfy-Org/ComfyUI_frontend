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

    expect(screen.getByText('$336.00 billed yearly')).toBeInTheDocument()
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

  it('displays the exact fractional charge', () => {
    render(EmbeddedCheckout, {
      props: {
        ...checkoutProps,
        monthlyPriceCents: 5454,
        amountDueCents: 33_649
      },
      global: { plugins: [createBillingI18n()] }
    })

    expect(screen.getByText('$54.54')).toBeInTheDocument()
    expect(screen.getByText('$336.49 billed yearly')).toBeInTheDocument()
    expect(screen.getByText('$336.49')).toBeInTheDocument()
  })

  it('disables checkout controls until the SDK is connected', async () => {
    const onConfirm = vi.fn()

    render(EmbeddedCheckout, {
      props: { ...checkoutProps, checkoutEnabled: false, onConfirm },
      global: { plugins: [createBillingI18n()] }
    })

    expect(
      screen.getByRole('textbox', { name: 'Promotion code' })
    ).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled()
    const confirmButton = screen.getByRole('button', {
      name: 'Pay and subscribe'
    })
    expect(confirmButton).toBeDisabled()
    await userEvent.click(confirmButton)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('supports monthly billing and host navigation', async () => {
    const onBack = vi.fn()
    const onClose = vi.fn()

    render(EmbeddedCheckout, {
      props: {
        ...checkoutProps,
        billingCycle: 'monthly',
        onBack,
        onClose
      },
      global: { plugins: [createBillingI18n()] }
    })

    expect(screen.getByText('Billed monthly')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Back' }))
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onBack).toHaveBeenCalledOnce()
    expect(onClose).toHaveBeenCalledOnce()
  })
})
