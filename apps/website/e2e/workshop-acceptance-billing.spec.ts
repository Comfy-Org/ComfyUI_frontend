import { expect } from '@playwright/test'

import { readBalanceCents } from '../acceptance/billing'
import { waitForBalance } from '../acceptance/fixtures'
import { test } from './fixtures/blockExternalMedia'

test('acceptance waits through a failed balance read and delayed fractional usage', async () => {
  const observations = [
    readBalanceCents({}),
    readBalanceCents({ currency: 'USD', amount_micros: 1000 }),
    readBalanceCents({
      currency: 'USD',
      amount_micros: 1000,
      effective_balance_micros: 995.5,
      pending_charges_micros: 4.5
    })
  ]
  let reads = 0
  await waitForBalance(async () => {
    const observation = observations.at(reads++)
    if (!observation) throw new Error('Unexpected additional balance read')
    return observation
  }, 995.5)
  expect(reads).toBe(3)
})
