import { describe, expect, it } from 'vitest'

import { ADD_CREDITS_FALLBACK_BOUNDS } from './addCreditsAmount'
import type {
  AddCreditsEvent,
  AddCreditsFacts,
  AddCreditsState
} from './addCreditsDialog'
import {
  reduceAddCredits,
  startAddCredits,
  viewAddCreditsAmount
} from './addCreditsDialog'

const FIFTY = { kind: 'preset', cents: 5000 } as const
const FAILED = { kind: 'checkout_failed' } as const
const URL = 'https://billing.comfy.org/topup?session=1'

const STATES = {
  amount: { step: 'amount', amount: FIFTY },
  openingWithTab: {
    step: 'opening',
    amount: FIFTY,
    amountCents: 5000,
    origin: 'amount',
    tabReserved: true
  },
  openingWithoutTab: {
    step: 'opening',
    amount: FIFTY,
    amountCents: 5000,
    origin: 'amount',
    tabReserved: false
  },
  reopening: {
    step: 'opening',
    amount: FIFTY,
    amountCents: 5000,
    origin: 'checkout_opened',
    tabReserved: true
  },
  opened: { step: 'checkout_opened', amount: FIFTY, amountCents: 5000 },
  blocked: {
    step: 'checkout_blocked',
    amount: FIFTY,
    amountCents: 5000,
    checkoutUrl: URL
  },
  landed: { step: 'landed' }
} as const satisfies Record<string, AddCreditsState>

type StateName = keyof typeof STATES

const EVENTS = {
  preset: { type: 'preset_picked', cents: 2500 },
  typed: { type: 'amount_typed', input: '40' },
  requested: {
    type: 'checkout_requested',
    amountCents: 5000,
    tabReserved: true
  },
  created: { type: 'checkout_created', checkoutUrl: URL },
  refused: { type: 'checkout_refused', refusal: FAILED },
  abandoned: { type: 'checkout_abandoned' },
  followed: { type: 'blocked_link_followed' },
  landed: { type: 'payment_landed' }
} as const satisfies Record<string, AddCreditsEvent>

type EventName = keyof typeof EVENTS

const TRANSITIONS: Partial<
  Record<StateName, Partial<Record<EventName, AddCreditsState>>>
> = {
  amount: {
    preset: { step: 'amount', amount: { kind: 'preset', cents: 2500 } },
    typed: { step: 'amount', amount: { kind: 'custom', input: '40' } },
    requested: STATES.openingWithTab
  },
  openingWithTab: {
    created: STATES.opened,
    refused: { step: 'amount', amount: FIFTY, refusal: FAILED },
    abandoned: STATES.amount,
    landed: STATES.landed
  },
  openingWithoutTab: {
    created: STATES.blocked,
    refused: { step: 'amount', amount: FIFTY, refusal: FAILED },
    abandoned: STATES.amount,
    landed: STATES.landed
  },
  reopening: {
    created: STATES.opened,
    refused: { ...STATES.opened, refusal: FAILED },
    abandoned: STATES.opened,
    landed: STATES.landed
  },
  opened: { requested: STATES.reopening, landed: STATES.landed },
  blocked: { followed: STATES.opened, landed: STATES.landed }
}

const PAIRS = Object.keys(STATES).flatMap((state) =>
  Object.keys(EVENTS).map((event) => ({
    state: state as StateName,
    event: event as EventName
  }))
)

describe('reduceAddCredits', () => {
  it.for(PAIRS)('$state + $event', ({ state, event }) => {
    expect(reduceAddCredits(STATES[state], EVENTS[event])).toStrictEqual(
      TRANSITIONS[state]?.[event] ?? STATES[state]
    )
  })

  it('a refused amount clears its notice once the amount changes', () => {
    const refused = reduceAddCredits(STATES.openingWithTab, EVENTS.refused)

    expect(reduceAddCredits(refused, EVENTS.typed)).toStrictEqual({
      step: 'amount',
      amount: { kind: 'custom', input: '40' }
    })
  })

  it('starts on the amount step', () => {
    expect(startAddCredits(FIFTY)).toStrictEqual(STATES.amount)
  })
})

const ALLOWED: AddCreditsFacts = {
  bounds: ADD_CREDITS_FALLBACK_BOUNDS,
  canTopUp: true
}

describe('viewAddCreditsAmount', () => {
  it.for<{
    name: string
    state: AddCreditsState & { step: 'amount' | 'opening' }
    facts?: Partial<AddCreditsFacts>
    expected: Record<string, unknown>
  }>([
    {
      name: 'the default amount',
      state: STATES.amount,
      expected: {
        amountCents: 5000,
        notice: undefined,
        locked: false,
        canContinue: true
      }
    },
    {
      name: 'an emptied field',
      state: { step: 'amount', amount: { kind: 'custom', input: '' } },
      expected: { amountCents: undefined, canContinue: false }
    },
    {
      name: 'an amount below the minimum',
      state: { step: 'amount', amount: { kind: 'custom', input: '3' } },
      expected: {
        check: { status: 'invalid', error: 'below_min' },
        canContinue: false
      }
    },
    {
      name: 'opening checkout',
      state: STATES.openingWithTab,
      expected: { locked: true, opening: true, canContinue: false }
    },
    {
      name: "couldn't open checkout",
      state: { step: 'amount', amount: FIFTY, refusal: FAILED },
      expected: {
        notice: { kind: 'refusal', refusal: FAILED },
        canContinue: true
      }
    },
    {
      name: 'rate limited',
      state: {
        step: 'amount',
        amount: FIFTY,
        refusal: { kind: 'rate_limited', retryAfterSeconds: 60 }
      },
      expected: {
        notice: {
          kind: 'refusal',
          refusal: { kind: 'rate_limited', retryAfterSeconds: 60 }
        },
        canContinue: false
      }
    },
    {
      name: 'can_top_up going false',
      state: { step: 'amount', amount: FIFTY, refusal: FAILED },
      facts: { canTopUp: false },
      expected: {
        notice: { kind: 'refusal', refusal: { kind: 'not_allowed' } },
        canContinue: false
      }
    },
    {
      name: 'purchases stopped while open',
      state: STATES.amount,
      facts: {
        canTopUp: false,
        canTopUpRefusal: { kind: 'purchases_paused' }
      },
      expected: {
        notice: { kind: 'refusal', refusal: { kind: 'purchases_paused' } },
        canContinue: false
      }
    },
    {
      name: 'a denial served with a non-blocking refusal',
      state: STATES.amount,
      facts: { canTopUp: false, canTopUpRefusal: FAILED },
      expected: {
        notice: { kind: 'refusal', refusal: FAILED },
        canContinue: false
      }
    },
    {
      name: 'an earlier payment still processing',
      state: STATES.amount,
      facts: { pendingTopup: { kind: 'processing', amountCents: 2500 } },
      expected: {
        amountCents: 5000,
        notice: { kind: 'processing', amountCents: 2500 },
        locked: false,
        canContinue: true
      }
    },
    {
      name: 'a payment that needs verification',
      state: STATES.amount,
      facts: {
        pendingTopup: {
          kind: 'needs_verification',
          amountCents: 2500,
          verifyUrl: URL
        }
      },
      expected: {
        amountCents: 2500,
        notice: {
          kind: 'needs_verification',
          amountCents: 2500,
          verifyUrl: URL
        },
        locked: true,
        canContinue: false
      }
    },
    {
      name: "a payment that wasn't verified",
      state: STATES.amount,
      facts: { pendingTopup: { kind: 'not_verified' } },
      expected: {
        amountCents: undefined,
        notice: { kind: 'not_verified' },
        locked: true,
        canContinue: false
      }
    }
  ])('$name', ({ state, facts, expected }) => {
    expect(viewAddCreditsAmount(state, { ...ALLOWED, ...facts })).toMatchObject(
      expected
    )
  })
})
