import { describe, expect, it } from 'vitest'

import {
  DEFAULT_PAYMENT_COPY,
  createPaymentCopy,
  paymentCopyKeys
} from './paymentCopy.js'

describe('createPaymentCopy', () => {
  it('accepts host overrides but never the safety line', () => {
    const copy = createPaymentCopy({
      'billing.safety.nothing_was_charged': 'Relax, you were not billed.',
      'billing.step.success.header': 'Done'
    })

    expect(copy['billing.step.success.header']).toBe('Done')
    expect(copy['billing.safety.nothing_was_charged']).toBe(
      DEFAULT_PAYMENT_COPY['billing.safety.nothing_was_charged']
    )
  })
})

describe('paymentCopyKeys', () => {
  it('unlocks the safety line only for a canceled step with a confirmed no-charge', () => {
    expect(
      paymentCopyKeys({ step: 'canceled', noChargeConfirmed: false }).safety
    ).toBeUndefined()
    expect(
      paymentCopyKeys({ step: 'success', noChargeConfirmed: true }).safety
    ).toBeUndefined()
    expect(
      paymentCopyKeys({ step: 'canceled', noChargeConfirmed: true }).safety
    ).toBe('billing.safety.nothing_was_charged')
  })

  it('names the step copy and a reason only when the projection carries one', () => {
    expect(
      paymentCopyKeys({
        step: 'declined',
        reasonKey: 'insufficient_funds',
        noChargeConfirmed: false
      })
    ).toEqual({
      header: 'billing.step.declined.header',
      body: 'billing.step.declined.body',
      reason: 'billing.reason.insufficient_funds'
    })
    expect(
      paymentCopyKeys({ step: 'verifying', noChargeConfirmed: false })
    ).toEqual({
      header: 'billing.step.verifying.header',
      body: 'billing.step.verifying.body'
    })
  })

  it.for([
    'retry',
    'replace_payment_method',
    'authenticate_payment',
    'contact_support'
  ] as const)(
    'reads the body from the server recovery action %s',
    (recoveryAction) => {
      expect(
        paymentCopyKeys({
          step: 'processing_error',
          reasonKey: 'generic',
          recoveryAction,
          noChargeConfirmed: false
        }).body
      ).toBe(`billing.recovery.${recoveryAction}`)
    }
  )
})
