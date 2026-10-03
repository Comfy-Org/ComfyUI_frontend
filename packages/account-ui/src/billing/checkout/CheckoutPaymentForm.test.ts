import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

import type { StripePaymentPhase } from '../stripe/stripePaymentPhase'
import CheckoutPaymentForm from './CheckoutPaymentForm.vue'
import { checkoutCopy } from './__fixtures__/copy'

let reportPhase: (phase: StripePaymentPhase) => void = () => {}

const StripeFormStub = defineComponent({
  name: 'StripePaymentForm',
  props: {
    isLoading: Boolean,
    verificationPending: Boolean,
    canSubmit: Boolean
  },
  emits: ['phase'],
  setup(props, { emit, slots }) {
    reportPhase = (phase) => emit('phase', phase)
    return () =>
      h('form', [
        slots.submit?.({
          disabled: !props.canSubmit || props.verificationPending,
          loading: props.isLoading,
          verificationPending: props.verificationPending
        })
      ])
  }
})

function renderForm(props: Record<string, unknown> = {}) {
  return render(CheckoutPaymentForm, {
    props: {
      publishableKey: 'pk_test',
      amountCents: 1500,
      currency: 'usd',
      copy: checkoutCopy.payment,
      submitLabel: 'Pay and subscribe',
      ...props
    },
    global: { stubs: { StripePaymentForm: StripeFormStub } }
  })
}

describe('CheckoutPaymentForm', () => {
  it('renders the pay action into the form through its submit slot', () => {
    renderForm()
    expect(
      screen.getByRole('button', { name: 'Pay and subscribe' })
    ).toHaveProperty('type', 'submit')
  })

  it('steps the pay action back while a verification is pending', () => {
    renderForm({ verificationPending: true })
    expect(
      screen.getByRole('button', { name: 'Pay and subscribe' })
    ).toHaveProperty('disabled', true)
  })

  it('passes on the phases the provider form reports', () => {
    const onPhase = vi.fn()
    renderForm({ onPhase })
    reportPhase({ phase: 'payment_element_ready', element: 'payment' })
    expect(onPhase).toHaveBeenCalledWith({
      phase: 'payment_element_ready',
      element: 'payment'
    })
  })
})
