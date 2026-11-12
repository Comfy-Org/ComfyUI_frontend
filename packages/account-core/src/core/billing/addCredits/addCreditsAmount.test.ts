import { zCreateTopupCheckoutRequest } from '@comfyorg/ingest-types/zod'
import { describe, expect, it } from 'vitest'

import {
  ADD_CREDITS_FALLBACK_BOUNDS,
  checkAddCreditsAmount,
  initialAddCreditsAmount
} from './addCreditsAmount'

const BOUNDS = ADD_CREDITS_FALLBACK_BOUNDS

describe('checkAddCreditsAmount', () => {
  it.for([
    { bound: 'minimum', amount_cents: BOUNDS.minCents },
    { bound: 'maximum', amount_cents: BOUNDS.maxCents }
  ])(
    'sends a fallback $bound the hosted checkout request accepts',
    ({ amount_cents }) => {
      expect(
        zCreateTopupCheckoutRequest.safeParse({
          amount_cents,
          return_url: 'https://cloud.comfy.org/billing/return'
        })
      ).toMatchObject({ success: true })
    }
  )

  it.for([
    { input: '', expected: { status: 'empty' } },
    { input: '   ', expected: { status: 'empty' } },
    { input: '40', expected: { status: 'valid', cents: 4000 } },
    { input: '12.', expected: { status: 'valid', cents: 1200 } },
    { input: '12.00', expected: { status: 'valid', cents: 1200 } },
    { input: '5', expected: { status: 'valid', cents: 500 } },
    { input: '2500', expected: { status: 'valid', cents: 250_000 } },
    { input: '3', expected: { status: 'invalid', error: 'below_min' } },
    { input: '0.5', expected: { status: 'invalid', error: 'below_min' } },
    { input: '2501', expected: { status: 'invalid', error: 'above_max' } },
    { input: '12.34', expected: { status: 'invalid', error: 'whole_dollars' } },
    { input: '12.5', expected: { status: 'invalid', error: 'whole_dollars' } },
    { input: 'abc', expected: { status: 'invalid', error: 'whole_dollars' } },
    { input: '.', expected: { status: 'invalid', error: 'whole_dollars' } },
    { input: '-5', expected: { status: 'invalid', error: 'whole_dollars' } }
  ])('reads "$input" as $expected.status', ({ input, expected }) => {
    expect(
      checkAddCreditsAmount({ kind: 'custom', input }, BOUNDS)
    ).toStrictEqual(expected)
  })

  it('checks a preset against the served bounds', () => {
    expect(
      checkAddCreditsAmount(
        { kind: 'preset', cents: 10000 },
        { minCents: 500, maxCents: 5000 }
      )
    ).toStrictEqual({ status: 'invalid', error: 'above_max' })
  })
})

describe('initialAddCreditsAmount', () => {
  it.for([
    { suggested: undefined, expected: { kind: 'preset', cents: 5000 } },
    { suggested: null, expected: { kind: 'preset', cents: 5000 } },
    { suggested: 5000, expected: { kind: 'preset', cents: 5000 } },
    { suggested: 11400, expected: { kind: 'custom', input: '114' } },
    { suggested: 11450, expected: { kind: 'preset', cents: 5000 } }
  ])(
    'opens on $expected.kind for a suggestion of $suggested',
    ({ suggested, expected }) => {
      expect(initialAddCreditsAmount(suggested)).toStrictEqual(expected)
    }
  )
})
