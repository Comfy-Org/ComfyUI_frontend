import type { HostedTopupCheckout } from '@comfyorg/ingest-types'
import { describe, expect, it } from 'vitest'

import { processingTopupPayment } from '@/platform/billing/processingTopupPayment'
import type { ProcessingTopupPayment } from '@/platform/billing/processingTopupPayment'

function checkout(
  state: HostedTopupCheckout['state'],
  paymentAmountCents: number | null = null,
  sessionId = `cs_${state}`
): HostedTopupCheckout {
  return {
    amount_cents: 2500,
    payment_amount_cents: paymentAmountCents,
    session_id: sessionId,
    state
  }
}

describe('processingTopupPayment', () => {
  it.for<{
    case: string
    checkouts: HostedTopupCheckout[]
    expected: ProcessingTopupPayment | null
  }>([
    {
      case: 'a bank payment still processing',
      checkouts: [checkout('payment_processing', 2500)],
      expected: { paymentAmountCents: 2500 }
    },
    {
      case: 'a processing payment with no served amount',
      checkouts: [checkout('payment_processing', null)],
      expected: { paymentAmountCents: null }
    },
    {
      case: 'a processing payment whose amount is not a served cent total',
      checkouts: [checkout('payment_processing', -1)],
      expected: { paymentAmountCents: null }
    },
    {
      case: 'a fully discounted processing payment',
      checkouts: [checkout('payment_processing', 0)],
      expected: { paymentAmountCents: 0 }
    },
    {
      case: 'two processing payments',
      checkouts: [
        checkout('payment_processing', 2500, 'cs_a'),
        checkout('payment_processing', 2500, 'cs_b')
      ],
      expected: { paymentAmountCents: null }
    },
    {
      case: 'an open checkout beside one still processing',
      checkouts: [
        checkout('open', 1000, 'cs_open'),
        checkout('payment_processing', 2500, 'cs_bank')
      ],
      expected: { paymentAmountCents: 2500 }
    },
    ...(
      ['open', 'credits_applying', 'fulfilled', 'expired', 'failed'] as const
    ).map((state) => ({
      case: `a checkout whose state is ${state}`,
      checkouts: [checkout(state, 2500)],
      expected: null
    })),
    {
      case: 'no checkouts',
      checkouts: [],
      expected: null
    }
  ])('$case', ({ checkouts, expected }) => {
    expect(processingTopupPayment(checkouts)).toEqual(expected)
  })
})
