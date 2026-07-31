import userEvent from '@testing-library/user-event'
import { cleanup, render, screen, waitFor } from '@testing-library/vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import UnifiedStripePaymentSelector from './UnifiedStripePaymentSelector.vue'

const stripeMocks = vi.hoisted(() => {
  const mount = vi.fn()
  const destroy = vi.fn()
  const on = vi.fn()
  const submit = vi.fn()
  const create = vi.fn(() => ({ mount, destroy, on }))
  const elements = { submit, create }
  const createConfirmationToken = vi.fn()
  const stripe = {
    elements: vi.fn(() => elements),
    createConfirmationToken
  }
  return {
    mount,
    destroy,
    on,
    submit,
    create,
    elements,
    createConfirmationToken,
    stripe,
    loadStripe: vi.fn(() => Promise.resolve(stripe))
  }
})

vi.mock('@stripe/stripe-js', () => ({
  loadStripe: stripeMocks.loadStripe
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: { error: 'Error' },
      subscription: {
        preview: {
          paymentMethod: 'Payment method',
          stripeMethodChoice: 'Choose a payment method',
          alipayRenewalNote: 'Alipay renewal note',
          payAndSubscribe: 'Pay and subscribe',
          stripeUnavailable: 'Stripe is unavailable'
        }
      }
    }
  }
})

function renderSelector(amountCents = 66500) {
  return render(UnifiedStripePaymentSelector, {
    props: { amountCents, currency: 'usd' },
    global: { plugins: [i18n] }
  })
}

describe('UnifiedStripePaymentSelector', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_STRIPE_PUBLISHABLE_KEY', 'pk_test_example')
    vi.resetAllMocks()
    stripeMocks.loadStripe.mockResolvedValue(stripeMocks.stripe)
    stripeMocks.stripe.elements.mockReturnValue(stripeMocks.elements)
    stripeMocks.create.mockReturnValue({
      mount: stripeMocks.mount,
      destroy: stripeMocks.destroy,
      on: stripeMocks.on
    })
    stripeMocks.submit.mockResolvedValue({})
    stripeMocks.createConfirmationToken.mockResolvedValue({
      confirmationToken: { id: 'ctoken_1' }
    })
  })

  afterEach(cleanup)

  it('collects deferred subscription details and emits a confirmation token', async () => {
    const user = userEvent.setup()
    const { emitted } = renderSelector()

    await waitFor(() => {
      expect(stripeMocks.stripe.elements).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'subscription',
          amount: 66500,
          currency: 'usd',
          setupFutureUsage: 'off_session',
          paymentMethodTypes: ['card', 'alipay']
        })
      )
    })
    expect(stripeMocks.create).toHaveBeenCalledWith('payment', {
      layout: {
        type: 'accordion',
        defaultCollapsed: false,
        radios: 'always',
        spacedAccordionItems: true
      },
      terms: { card: 'never' }
    })
    expect(stripeMocks.mount).toHaveBeenCalledTimes(1)

    await user.click(
      screen.getByRole('button', {
        name: 'Pay and subscribe'
      })
    )

    expect(stripeMocks.submit).toHaveBeenCalledTimes(1)
    expect(stripeMocks.createConfirmationToken).toHaveBeenCalledWith({
      elements: stripeMocks.elements
    })
    expect(emitted().confirm).toEqual([['ctoken_1']])
  })

  it('keeps the customer in the form when Stripe rejects its contents', async () => {
    const user = userEvent.setup()
    stripeMocks.submit.mockResolvedValue({
      error: { message: 'Payment details are incomplete' }
    })
    const { emitted } = renderSelector()

    await waitFor(() => expect(stripeMocks.mount).toHaveBeenCalledTimes(1))
    await user.click(
      screen.getByRole('button', {
        name: 'Pay and subscribe'
      })
    )

    expect(
      await screen.findByText('Payment details are incomplete')
    ).toBeTruthy()
    expect(stripeMocks.createConfirmationToken).not.toHaveBeenCalled()
    expect(emitted().confirm).toBeUndefined()
  })

  it('destroys the Stripe element when the preview unmounts', async () => {
    const { unmount } = renderSelector()
    await waitFor(() => expect(stripeMocks.mount).toHaveBeenCalledTimes(1))

    unmount()

    expect(stripeMocks.destroy).toHaveBeenCalledTimes(1)
  })
})
