import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import PaymentDeclinedDialogContent from './PaymentDeclinedDialogContent.vue'

const state = vi.hoisted(() => ({
  manageSubscription: vi.fn(),
  toastAdd: vi.fn()
}))

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({
    manageSubscription: state.manageSubscription
  })
}))

vi.mock('primevue/usetoast', () => ({
  useToast: () => ({ add: state.toastAdd })
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: { close: 'Close' },
      paymentDeclined: {
        title: 'Payment declined',
        body: "Your card couldn't be charged. Try another card, or contact your bank if this looks wrong.",
        reasonLabel: 'Stripe reasoning:',
        updatePaymentMethod: 'Update payment method',
        portalError: "Couldn't open the billing portal. Please try again."
      },
      subscription: {
        preview: { backToAllPlans: 'Back to all plans' }
      }
    }
  }
})

function renderDialog(origin: 'subscription' | 'topup', onClose = vi.fn()) {
  render(PaymentDeclinedDialogContent, {
    props: {
      origin,
      reason: 'Insufficient funds',
      onClose
    },
    global: { plugins: [i18n] }
  })
  return { onClose }
}

describe('PaymentDeclinedDialogContent', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    state.manageSubscription.mockResolvedValue(undefined)
  })

  it('opens the billing portal without dismissing the declined subscription', async () => {
    const { onClose } = renderDialog('subscription')

    expect(screen.getByText('Insufficient funds')).toBeInTheDocument()
    await userEvent.click(
      screen.getByRole('button', { name: 'Update payment method' })
    )

    expect(state.manageSubscription).toHaveBeenCalledOnce()
    expect(onClose).not.toHaveBeenCalled()
    expect(
      screen.getByRole('heading', { name: 'Payment declined' })
    ).toBeInTheDocument()
  })

  it('returns to the preserved subscription flow from the secondary action', async () => {
    const { onClose } = renderDialog('subscription')

    await userEvent.click(
      screen.getByRole('button', { name: 'Back to all plans' })
    )

    expect(onClose).toHaveBeenCalledOnce()
  })

  it('returns to the preserved top-up flow through close', async () => {
    const { onClose } = renderDialog('topup')

    expect(
      screen.queryByRole('button', { name: 'Back to all plans' })
    ).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(onClose).toHaveBeenCalledOnce()
  })

  it('keeps the declined surface available when the billing portal fails', async () => {
    state.manageSubscription.mockRejectedValue(new Error('Portal unavailable'))
    renderDialog('topup')

    await userEvent.click(
      screen.getByRole('button', { name: 'Update payment method' })
    )

    expect(state.toastAdd).toHaveBeenCalledWith({
      severity: 'error',
      summary: "Couldn't open the billing portal. Please try again.",
      detail: 'Portal unavailable'
    })
    expect(screen.getByText('Insufficient funds')).toBeInTheDocument()
  })
})
