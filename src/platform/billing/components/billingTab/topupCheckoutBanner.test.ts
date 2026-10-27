import { describe, expect, it } from 'vitest'

import type { HostedTopupCheckout } from '@comfyorg/ingest-types'

import {
  addCreditsEmphasis,
  selectTopupCheckoutBanner
} from './topupCheckoutBanner'
import type { TopupCheckoutBanner } from './topupCheckoutBanner'

function checkout(
  session_id: string,
  state: HostedTopupCheckout['state'],
  payment_amount_cents: number | null = 2500
): HostedTopupCheckout {
  return { session_id, state, amount_cents: 2500, payment_amount_cents }
}

function select(
  checkouts: HostedTopupCheckout[],
  dismissed: string[] = [],
  newestSessionId: string | null = checkouts[0]?.session_id ?? null
) {
  return selectTopupCheckoutBanner(
    { newestSessionId, checkouts },
    new Set(dismissed)
  )
}

describe('selectTopupCheckoutBanner', () => {
  it.for<{
    case: string
    checkouts: HostedTopupCheckout[]
    expected: TopupCheckoutBanner | null
  }>([
    { case: 'no checkouts', checkouts: [], expected: null },
    {
      case: 'only open, expired and fulfilled checkouts',
      checkouts: [
        checkout('cs_open', 'open'),
        checkout('cs_expired', 'expired'),
        checkout('cs_done', 'fulfilled')
      ],
      expected: null
    },
    {
      case: 'a payment processing behind a newer open checkout',
      checkouts: [
        checkout('cs_open', 'open'),
        checkout('cs_bank', 'payment_processing')
      ],
      expected: { kind: 'processing', sessionId: 'cs_bank' }
    },
    {
      case: 'credits applying alongside a processing payment',
      checkouts: [
        checkout('cs_bank', 'payment_processing'),
        checkout('cs_paid', 'credits_applying')
      ],
      expected: { kind: 'creditsApplying', sessionId: 'cs_paid' }
    },
    {
      case: 'the newest checkout failed while an older one applies credits',
      checkouts: [
        checkout('cs_failed', 'failed', 2500),
        checkout('cs_paid', 'credits_applying')
      ],
      expected: {
        kind: 'failed',
        sessionId: 'cs_failed',
        paymentAmountCents: 2500
      }
    },
    {
      case: 'a failed checkout a newer checkout replaced',
      checkouts: [checkout('cs_new', 'open'), checkout('cs_failed', 'failed')],
      expected: null
    }
  ])('picks the banner for $case', ({ checkouts, expected }) => {
    expect(select(checkouts)).toEqual(expected)
  })

  it('keeps a failed checkout quiet when the newest summary was unreadable', () => {
    expect(
      select([checkout('cs_failed', 'failed')], [], 'cs_unreadable')
    ).toBeNull()
  })

  it.for([
    { served: null, expected: null },
    { served: 1250, expected: 1250 },
    { served: 12.5, expected: null },
    { served: -100, expected: null }
  ])(
    'renders a served payment amount of $served as $expected',
    ({ served, expected }) => {
      expect(select([checkout('cs_failed', 'failed', served)])).toEqual({
        kind: 'failed',
        sessionId: 'cs_failed',
        paymentAmountCents: expected
      })
    }
  )

  it('reveals the next banner once the top one is dismissed', () => {
    const checkouts = [
      checkout('cs_failed', 'failed'),
      checkout('cs_bank', 'payment_processing')
    ]

    expect(select(checkouts, ['cs_failed:failed'])).toEqual({
      kind: 'processing',
      sessionId: 'cs_bank'
    })
  })

  it.for([
    {
      case: 'a failed top-up at 0',
      availableCents: 0,
      banner: { kind: 'failed', sessionId: 'cs', paymentAmountCents: 2500 },
      variant: 'inverted'
    },
    {
      case: 'a payment still processing at 0',
      availableCents: 0,
      banner: { kind: 'processing', sessionId: 'cs' },
      variant: 'secondary'
    },
    {
      case: 'credits still landing at 0',
      availableCents: 0,
      banner: { kind: 'creditsApplying', sessionId: 'cs' },
      variant: 'secondary'
    },
    {
      case: 'a failed top-up with credits left',
      availableCents: 500,
      banner: { kind: 'failed', sessionId: 'cs', paymentAmountCents: 2500 },
      variant: 'secondary'
    },
    {
      case: 'no banner at 0',
      availableCents: 0,
      banner: null,
      variant: 'secondary'
    }
  ] as const)(
    'uses $variant for $case',
    ({ availableCents, banner, variant }) => {
      expect(addCreditsEmphasis(availableCents, banner)).toBe(variant)
    }
  )

  it('shows a dismissed processing payment again once its credits apply', () => {
    expect(
      select([checkout('cs_bank', 'credits_applying')], ['cs_bank:processing'])
    ).toEqual({ kind: 'creditsApplying', sessionId: 'cs_bank' })
  })
})
