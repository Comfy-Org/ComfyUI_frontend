import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

import type { SavedPaymentMethod } from '@comfyorg/account-core/billing'

import CheckoutSubscribeConfirm from './CheckoutSubscribeConfirm.vue'
import { checkoutCopy, creatorPlan, teamPlan } from './__fixtures__/copy'
import { exactPreview, legacyPreview, plan } from './__fixtures__/preview'

const PaymentFormStub = defineComponent({
  name: 'CheckoutPaymentForm',
  props: { amountCents: Number, currency: String, canSubmit: Boolean },
  emits: ['confirm'],
  setup(props, { emit }) {
    return () =>
      h(
        'button',
        {
          'data-testid': 'payment-form',
          onClick: () => emit('confirm', 'ctoken_1', 'card')
        },
        `${props.amountCents} ${props.currency}`
      )
  }
})

const card: SavedPaymentMethod = {
  id: 'pm_card',
  type: 'card',
  brand: 'visa',
  last4: '4242',
  is_default: true
}
const alipay: SavedPaymentMethod = {
  id: 'pm_alipay',
  type: 'alipay',
  is_default: false
}

type Props = InstanceType<typeof CheckoutSubscribeConfirm>['$props']

function renderConfirm(props: Partial<Props> = {}) {
  return render(CheckoutSubscribeConfirm, {
    props: {
      plan: creatorPlan,
      copy: checkoutCopy,
      locale: 'en',
      publishableKey: 'pk_test',
      ...props
    },
    global: { stubs: { CheckoutPaymentForm: PaymentFormStub } }
  })
}

describe('CheckoutSubscribeConfirm', () => {
  it('prices the plan from its own catalog price before a quote arrives', () => {
    renderConfirm()
    expect(screen.getByText('Creator')).toBeTruthy()
    expect(screen.getByText('$35')).toBeTruthy()
    expect(screen.getByText('Billed monthly')).toBeTruthy()
    expect(screen.getByText('7,400')).toBeTruthy()
    expect(screen.queryByText('Total due today')).toBeNull()
  })

  it('shows the monthly equivalent and the annual total for a yearly quote', () => {
    renderConfirm({
      previewData: exactPreview({ new_plan: plan('CREATOR', 'ANNUAL', 33_600) })
    })
    expect(screen.getByText('$28')).toBeTruthy()
    expect(screen.getByText('$336 Billed yearly')).toBeTruthy()
    expect(screen.getByText('Each year credits refill to')).toBeTruthy()
    expect(screen.getByText('88,800')).toBeTruthy()
  })

  it('keeps a team credit stop priced by the stop, not the quote', () => {
    renderConfirm({ plan: teamPlan, previewData: exactPreview() })
    expect(screen.getByText('$1,330')).toBeTruthy()
    expect(screen.getByText('147,700')).toBeTruthy()
  })

  it('states the charge today and the renewal from the quote', () => {
    renderConfirm({ previewData: exactPreview() })
    expect(screen.getByText('$15.00')).toBeTruthy()
    expect(screen.getByText('Renews at $25.00 on Jul 19, 2026.')).toBeTruthy()
  })

  it('prices a legacy preview from the server costs', () => {
    renderConfirm({ previewData: legacyPreview() })
    expect(screen.getByText('$20.00')).toBeTruthy()
    expect(screen.getByText('Renews at $30.00.')).toBeTruthy()
  })

  it('lists the discounts the quote applied', () => {
    renderConfirm({
      previewData: exactPreview({
        discounts: [
          {
            kind: 'promotion',
            code: 'SPRING',
            name: 'Spring sale',
            amount_off_cents: 500
          }
        ]
      })
    })
    expect(screen.getByText('Promo code')).toBeTruthy()
    expect(screen.getByText(/Spring sale/).textContent).toContain('−$5.00')
  })

  it('withholds the card form until the quote can price it, then submits its token and its method type', async () => {
    const onConfirmPayment = vi.fn()
    const { rerender } = renderConfirm({
      usePaymentElement: true,
      onConfirmPayment
    })
    expect(screen.queryByTestId('payment-form')).toBeNull()
    expect(
      screen.getByRole('button', { name: 'Pay and subscribe' })
    ).toBeTruthy()

    await rerender({ previewData: exactPreview(), quoteIsCurrent: true })
    expect(screen.getByTestId('payment-form').textContent).toBe('1500 usd')
    await userEvent.click(screen.getByTestId('payment-form'))
    expect(onConfirmPayment).toHaveBeenCalledWith('ctoken_1', 'card')
  })

  it('confirms a zero-dollar quote without mounting the card form', async () => {
    const onAddCreditCard = vi.fn()
    renderConfirm({
      usePaymentElement: true,
      embeddedCheckoutEnabled: true,
      quoteIsCurrent: true,
      previewData: exactPreview({ amount_due_cents: 0 }),
      onAddCreditCard
    })
    expect(screen.queryByTestId('payment-form')).toBeNull()
    await userEvent.click(
      screen.getByRole('button', { name: 'Pay and subscribe' })
    )
    expect(onAddCreditCard).toHaveBeenCalledOnce()
  })

  it('subscribes through a hosted continuation when no card form is embedded', async () => {
    const onAddCreditCard = vi.fn()
    renderConfirm({ onAddCreditCard })
    await userEvent.click(
      screen.getByRole('button', { name: 'Subscribe to Creator' })
    )
    expect(onAddCreditCard).toHaveBeenCalledOnce()
  })

  it('shows a single saved method with a Change affordance instead of the card form', async () => {
    const onChangePaymentMethod = vi.fn()
    renderConfirm({
      usePaymentElement: true,
      embeddedCheckoutEnabled: true,
      quoteIsCurrent: true,
      previewData: exactPreview(),
      savedMethods: [card],
      onChangePaymentMethod
    })
    expect(screen.queryByTestId('payment-form')).toBeNull()
    expect(screen.getByText('visa •••• 4242')).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Change' }))
    expect(onChangePaymentMethod).toHaveBeenCalledOnce()
    expect(
      screen.getByRole('button', { name: 'Pay and subscribe' })
    ).toBeTruthy()
  })

  it('offers several saved methods through a picker', () => {
    renderConfirm({
      embeddedCheckoutEnabled: true,
      savedMethods: [card, alipay],
      selectedSavedMethodId: 'pm_card'
    })
    expect(
      screen.getByRole('combobox', { name: 'Select payment method' })
    ).toBeTruthy()
  })

  it('invalidates the quote while a promo is edited and applies it on click', async () => {
    const onInvalidateQuote = vi.fn()
    const onApplyPromotionCode = vi.fn()
    renderConfirm({
      embeddedCheckoutEnabled: true,
      previewData: exactPreview(),
      onInvalidateQuote,
      onApplyPromotionCode
    })
    await userEvent.type(
      screen.getByRole('textbox', { name: 'Promo code' }),
      'SPRING'
    )
    expect(onInvalidateQuote).toHaveBeenCalled()
    expect(onApplyPromotionCode).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }))
    expect(onApplyPromotionCode).toHaveBeenCalledWith('SPRING')
  })

  it('offers only the parked checkout recovery while an earlier checkout waits for a card', () => {
    renderConfirm({
      usePaymentElement: true,
      parkedCheckoutRecovery: true,
      previewData: exactPreview(),
      quoteIsCurrent: true
    })
    expect(screen.getByRole('alert').textContent).toContain(
      'Your earlier checkout is waiting for a card.'
    )
    expect(
      screen.getByRole('button', { name: 'Complete your payment' })
    ).toBeTruthy()
    expect(screen.queryByTestId('payment-form')).toBeNull()
    expect(
      screen.queryByRole('button', { name: 'Pay and subscribe' })
    ).toBeNull()
  })

  it('opens a pending verification in a new tab and locks paying beside it', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    renderConfirm({
      actionUrl: 'https://bank.example/3ds',
      authenticationState: 'requires_action'
    })
    expect(
      screen.getByRole('button', { name: 'Subscribe to Creator' })
    ).toHaveProperty('disabled', true)
    await userEvent.click(
      screen.getByRole('button', { name: 'Complete verification' })
    )
    expect(open).toHaveBeenCalledWith(
      'https://bank.example/3ds',
      '_blank',
      'noopener,noreferrer'
    )
  })

  it('reports a failed verification and a pending reconciliation', () => {
    renderConfirm({
      embeddedCheckoutEnabled: true,
      actionUrl: 'https://bank.example/3ds',
      authenticationState: 'failed_retryable',
      reconciliationOperationId: 'op_42'
    })
    expect(screen.getByRole('alert').textContent).toContain(
      'We could not complete payment verification.'
    )
    expect(screen.getByText('op_42')).toBeTruthy()
    expect(
      screen.queryByRole('button', { name: 'Complete verification' })
    ).toBeNull()
  })

  it('links the terms and privacy policy under the pay action', () => {
    renderConfirm()
    expect(
      screen.getByRole('link', { name: 'Terms' }).getAttribute('href')
    ).toBe('https://comfy.org/terms-of-service/')
    expect(
      screen.getByRole('link', { name: 'Privacy Policy' }).getAttribute('href')
    ).toBe('https://comfy.org/privacy-policy/')
  })

  it('goes back from its own back action', async () => {
    const onBack = vi.fn()
    renderConfirm({ onBack })
    await userEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(onBack).toHaveBeenCalledOnce()
  })
})
