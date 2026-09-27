import { describe, expect, it } from 'vitest'

import { readBalanceCents } from '../acceptance/billing'

describe('live effective balance in cents', () => {
  it.for([
    { amount_micros: 1000, expected: 1000 },
    {
      amount_micros: 1000,
      effective_balance_micros: 995.5,
      pending_charges_micros: 4.5,
      expected: 995.5
    },
    {
      amount_micros: 1000,
      effective_balance_micros: 991,
      pending_charges_micros: 9,
      expected: 991
    },
    { amount_micros: 1000, effective_balance_micros: 0, expected: 0 }
  ])(
    'reads $expected cents without requiring an invoice to close',
    ({ expected, ...body }) => {
      expect(readBalanceCents({ currency: 'USD', ...body })).toEqual({
        cents: expected
      })
    }
  )

  it.for([
    { currency: 'EUR', amount_micros: 1000 },
    { currency: 'USD', amount_micros: Infinity },
    { currency: 'USD', amount_micros: '1000' }
  ])('returns invalid responses as retryable observations: %j', (body) => {
    expect(readBalanceCents(body)).toHaveProperty('error')
  })
})
