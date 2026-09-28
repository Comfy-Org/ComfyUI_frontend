import type { PreviewSubscribeResult } from '@comfyorg/account-core/billing'
import { readBillingErrorCode } from '@comfyorg/account-core/billing'

import type { CheckoutPage } from '@/checkout/checkoutPage'
import type { PromoEntry, PromoEntryEvent } from '@/checkout/promoEntry'
import {
  initialPromoEntry,
  promoEntryLive,
  promoRejectionOf,
  reducePromoEntry
} from '@/checkout/promoEntry'

const idle: PromoEntry = { kind: 'idle' }
const editing = (draft: string): PromoEntry => ({ kind: 'editing', draft })
const applying = (draft: string): PromoEntry => ({ kind: 'applying', draft })
const applied = (code: string): PromoEntry => ({ kind: 'applied', code })
const rejected = (draft: string): PromoEntry => ({
  kind: 'rejected',
  draft,
  reason: 'invalid'
})

function run(start: PromoEntry, events: PromoEntryEvent[]): PromoEntry {
  return events.reduce(reducePromoEntry, start)
}

describe('reducePromoEntry', () => {
  it.for<{
    name: string
    start: PromoEntry
    events: PromoEntryEvent[]
    expected: PromoEntry
  }>([
    {
      name: 'a URL code opens the field typed but unapplied',
      start: initialPromoEntry('LAUNCH20'),
      events: [],
      expected: editing('LAUNCH20')
    },
    {
      name: 'no URL code starts collapsed',
      start: initialPromoEntry(undefined),
      events: [],
      expected: idle
    },
    {
      name: 'apply ok: the chip holds the code the server normalized',
      start: idle,
      events: [
        { type: 'opened' },
        { type: 'edited', draft: ' launch20 ' },
        { type: 'applyRequested' },
        { type: 'applyAccepted', code: 'LAUNCH20' }
      ],
      expected: applied('LAUNCH20')
    },
    {
      name: 'the trimmed draft is what goes out for a quote',
      start: editing(' launch20 '),
      events: [{ type: 'applyRequested' }],
      expected: applying('launch20')
    },
    {
      name: 'invalid at Apply: the typed value stays for correction',
      start: editing('NOPE'),
      events: [
        { type: 'applyRequested' },
        { type: 'applyRejected', reason: 'invalid' }
      ],
      expected: rejected('NOPE')
    },
    {
      name: 'typing after a rejection clears the error',
      start: rejected('NOPE'),
      events: [{ type: 'edited', draft: 'NOPE2' }],
      expected: editing('NOPE2')
    },
    {
      name: 'a rejected code can be applied again as typed',
      start: rejected('NOPE'),
      events: [{ type: 'applyRequested' }],
      expected: applying('NOPE')
    },
    {
      name: 'an empty field does not apply',
      start: editing('   '),
      events: [{ type: 'applyRequested' }],
      expected: editing('   ')
    },
    {
      name: 'the URL prefill is removable before it is applied',
      start: initialPromoEntry('LAUNCH20'),
      events: [{ type: 'dismissed' }],
      expected: idle
    },
    {
      name: 'removing the chip re-quotes, then collapses',
      start: applied('LAUNCH20'),
      events: [{ type: 'removeRequested' }, { type: 'removeSettled' }],
      expected: idle
    },
    {
      name: 'a failed removal keeps the chip the quote still carries',
      start: applied('LAUNCH20'),
      events: [{ type: 'removeRequested' }, { type: 'removeFailed' }],
      expected: applied('LAUNCH20')
    },
    {
      name: 'expired at Pay: the chip goes and the control returns',
      start: applied('LAUNCH20'),
      events: [{ type: 'expired' }],
      expected: idle
    },
    {
      name: 'the cap: an applied code cannot be reopened for a second',
      start: applied('LAUNCH20'),
      events: [{ type: 'opened' }, { type: 'edited', draft: 'SECOND' }],
      expected: applied('LAUNCH20')
    },
    {
      name: 'a late answer for an abandoned apply changes nothing',
      start: idle,
      events: [{ type: 'applyAccepted', code: 'LAUNCH20' }],
      expected: idle
    },
    {
      name: 'the field cannot change while its apply is in flight',
      start: applying('LAUNCH20'),
      events: [{ type: 'edited', draft: 'OTHER' }, { type: 'dismissed' }],
      expected: applying('LAUNCH20')
    }
  ])('$name', ({ start, events, expected }) => {
    expect(run(start, events)).toEqual(expected)
  })
})

function refusedWith(
  serverCode: string
): Extract<PreviewSubscribeResult, { status: 'error' }> {
  return {
    status: 'error',
    code: 'REQUEST_FAILED',
    httpStatus: 400,
    serverCode: readBillingErrorCode({ code: serverCode, message: 'refused' })
  }
}

describe('promoRejectionOf', () => {
  it.for([
    ['PROMOTION_CODE_INVALID', 'invalid'],
    ['PROMOTION_CODE_INAPPLICABLE', 'invalid'],
    ['PROMOTION_CODE_UNAVAILABLE', 'unchecked'],
    ['BILLING_UNAVAILABLE', 'unchecked']
  ] as const)('reads %s as %s', ([serverCode, expected]) => {
    expect(promoRejectionOf(refusedWith(serverCode))).toBe(expected)
  })

  it('leaves a code unjudged when the request never reached the server', () => {
    expect(promoRejectionOf({ status: 'error', code: 'REQUEST_FAILED' })).toBe(
      'unchecked'
    )
  })
})

const capture = (outcome?: 'reconciling' | 'price_updated'): CheckoutPage => ({
  kind: 'capture',
  rail: { method: 'on_file' },
  reactivation: 'not_required',
  attempt: { kind: 'idle' },
  ...(outcome === undefined ? {} : { outcome: { kind: outcome } })
})

describe('promoEntryLive', () => {
  it.for<{
    name: string
    page: CheckoutPage
    payInFlight: boolean
    live: boolean
  }>([
    {
      name: 'capture, nothing in flight',
      page: capture(),
      payInFlight: false,
      live: true
    },
    {
      name: 'capture after a re-quote card',
      page: capture('price_updated'),
      payInFlight: false,
      live: true
    },
    {
      name: 'from the Pay click through every in-flight state',
      page: capture(),
      payInFlight: true,
      live: false
    },
    {
      name: 'while a collided Pay is re-read',
      page: capture('reconciling'),
      payInFlight: false,
      live: false
    },
    {
      name: 'before the quote arrives',
      page: { kind: 'resolving' },
      payInFlight: false,
      live: false
    }
  ])('$name', ({ page, payInFlight, live }) => {
    expect(promoEntryLive(page, payInFlight)).toBe(live)
  })
})
