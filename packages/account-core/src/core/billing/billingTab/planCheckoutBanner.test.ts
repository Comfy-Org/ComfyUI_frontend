import type { BillingOpStatusResponse } from '@comfyorg/ingest-types'
import { describe, expect, it } from 'vitest'

import { planCheckoutBannerFor } from './planCheckoutBanner'

function operation(
  overrides: Partial<BillingOpStatusResponse>
): BillingOpStatusResponse {
  return {
    id: 'op-1',
    started_at: '2026-10-22T00:00:00Z',
    status: 'pending',
    ...overrides
  }
}

describe('planCheckoutBannerFor', () => {
  it('shows verify payment only from checkout_state', () => {
    expect(
      planCheckoutBannerFor(
        operation({
          checkout_state: 'verify_payment',
          action_url: 'https://pay.example/verify',
          phase: 'in_progress',
          authentication_state: 'succeeded'
        })
      )
    ).toEqual({
      kind: 'verifyPayment',
      opId: 'op-1',
      actionUrl: 'https://pay.example/verify'
    })
  })

  it('shows verify payment with no link when action_url is omitted', () => {
    expect(
      planCheckoutBannerFor(operation({ checkout_state: 'verify_payment' }))
    ).toEqual({
      kind: 'verifyPayment',
      opId: 'op-1',
      actionUrl: null
    })
  })

  it('shows payment received only from checkout_state', () => {
    expect(
      planCheckoutBannerFor(
        operation({
          checkout_state: 'payment_received',
          action_url: 'https://pay.example/verify',
          phase: 'awaiting_invoice_payment',
          authentication_state: 'requires_action'
        })
      )
    ).toEqual({ kind: 'paymentReceived', opId: 'op-1' })
  })

  it.for(['unfinished', 'processing', 'failed', 'none'] as const)(
    'hides checkout_state %s',
    (checkout_state) => {
      expect(planCheckoutBannerFor(operation({ checkout_state }))).toBeNull()
    }
  )

  it('treats an omitted checkout_state as unknown', () => {
    expect(
      planCheckoutBannerFor(
        operation({
          phase: 'awaiting_invoice_payment',
          authentication_state: 'requires_action',
          action_url: 'https://pay.example/verify'
        })
      )
    ).toBeNull()
  })
})
