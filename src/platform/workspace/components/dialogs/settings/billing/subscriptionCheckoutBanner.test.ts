import type {
  BillingOpReceiptPlan,
  BillingOpStatusResponse
} from '@comfyorg/ingest-types'
import { describe, expect, it } from 'vitest'

import {
  pickCheckoutBanner,
  subscriptionCheckoutBannerFor
} from './subscriptionCheckoutBanner'
import type { CheckoutBanner } from './subscriptionCheckoutBanner'

const plan: BillingOpReceiptPlan = {
  slug: 'creator-monthly',
  duration: 'MONTHLY',
  tier: 'CREATOR'
}

function operation(
  overrides: Partial<BillingOpStatusResponse>
): BillingOpStatusResponse {
  return {
    id: 'op-1',
    started_at: '2026-10-20T00:00:00Z',
    status: 'pending',
    plan,
    ...overrides
  }
}

describe('subscriptionCheckoutBannerFor', () => {
  it.for<{
    case: string
    served: Partial<BillingOpStatusResponse>
    expected: CheckoutBanner | null
  }>([
    {
      case: 'a checkout parked on a card with no link',
      served: { phase: 'awaiting_payment_method' },
      expected: { kind: 'planUnfinished', opId: 'op-1', plan }
    },
    {
      case: 'a parked checkout the server cannot name a plan for',
      served: { phase: 'awaiting_payment_method', plan: undefined },
      expected: null
    },
    {
      case: 'a parked checkout with a served verification link',
      served: {
        phase: 'awaiting_payment_method',
        action_url: 'https://pay.test'
      },
      expected: null
    },
    {
      case: 'a payment the bank is still processing',
      served: { phase: 'in_progress', authentication_state: 'processing' },
      expected: { kind: 'planProcessing', opId: 'op-1', plan }
    },
    {
      case: 'an operation the server is finishing',
      served: { phase: 'in_progress', authentication_state: 'succeeded' },
      expected: null
    },
    {
      case: 'a declined payment the customer may retry',
      served: {
        status: 'failed',
        decline_reason: 'insufficient_funds',
        retryable: true
      },
      expected: { kind: 'planFailed', opId: 'op-1', plan, retryable: true }
    },
    {
      case: 'a declined payment without a retry claim',
      served: { status: 'failed', decline_reason: 'card_declined' },
      expected: { kind: 'planFailed', opId: 'op-1', plan, retryable: false }
    },
    {
      case: 'a failure with no payment attempt, such as an abandoned checkout',
      served: { status: 'failed', error_message: 'checkout_abandoned' },
      expected: null
    },
    {
      case: 'a payment parked for reconciliation',
      served: { status: 'reconciliation_needed' },
      expected: null
    },
    {
      case: 'a succeeded operation',
      served: { status: 'succeeded' },
      expected: null
    }
  ])('reads $case', ({ served, expected }) => {
    expect(subscriptionCheckoutBannerFor(operation(served))).toEqual(expected)
  })
})

describe('pickCheckoutBanner', () => {
  const unfinished: CheckoutBanner = {
    kind: 'planUnfinished',
    opId: 'op',
    plan
  }
  const planProcessing: CheckoutBanner = {
    kind: 'planProcessing',
    opId: 'op',
    plan
  }
  const planFailed: CheckoutBanner = {
    kind: 'planFailed',
    opId: 'op',
    plan,
    retryable: true
  }
  const creditsProcessing: CheckoutBanner = {
    kind: 'processing',
    sessionId: 'cs'
  }
  const creditsApplying: CheckoutBanner = {
    kind: 'creditsApplying',
    sessionId: 'cs'
  }
  const creditsFailed: CheckoutBanner = {
    kind: 'failed',
    sessionId: 'cs',
    paymentAmountCents: null
  }

  it.for([
    {
      case: 'credits processing over an unfinished plan checkout',
      candidates: [unfinished, creditsProcessing],
      expected: creditsProcessing
    },
    {
      case: 'credits applying over a processing plan payment',
      candidates: [planProcessing, creditsApplying],
      expected: creditsApplying
    },
    {
      case: 'a failed plan over credits applying',
      candidates: [planFailed, creditsApplying],
      expected: planFailed
    },
    {
      case: 'the plan when both failed',
      candidates: [planFailed, creditsFailed],
      expected: planFailed
    },
    {
      case: 'the only candidate',
      candidates: [null, unfinished],
      expected: unfinished
    },
    { case: 'nothing', candidates: [null, null], expected: null }
  ])('picks $case', ({ candidates, expected }) => {
    expect(pickCheckoutBanner(candidates)).toEqual(expected)
  })
})
