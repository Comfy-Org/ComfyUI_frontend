import { describe, expect, it } from 'vitest'

import { isAnnualDuration, isYearlyCheckout } from './planDuration'

describe('isAnnualDuration', () => {
  it.for([
    { duration: 'ANNUAL', expected: true },
    { duration: 'MONTHLY', expected: false },
    { duration: undefined, expected: false }
  ] as const)(
    'returns $expected when duration is $duration',
    ({ duration, expected }) => {
      expect(isAnnualDuration(duration)).toBe(expected)
    }
  )
})

describe('isYearlyCheckout', () => {
  it.for([
    {
      duration: 'ANNUAL',
      billingCycle: 'yearly',
      expected: true
    },
    {
      duration: 'ANNUAL',
      billingCycle: 'monthly',
      expected: true
    },
    {
      duration: 'MONTHLY',
      billingCycle: 'yearly',
      expected: false
    },
    {
      duration: 'MONTHLY',
      billingCycle: 'monthly',
      expected: false
    }
  ] as const)(
    'prefers duration $duration over billingCycle $billingCycle',
    ({ duration, billingCycle, expected }) => {
      expect(isYearlyCheckout(duration, billingCycle)).toBe(expected)
    }
  )

  it.for([
    { billingCycle: 'yearly', expected: true },
    { billingCycle: 'monthly', expected: false }
  ] as const)(
    'falls back to billingCycle $billingCycle when duration is undefined',
    ({ billingCycle, expected }) => {
      expect(isYearlyCheckout(undefined, billingCycle)).toBe(expected)
    }
  )
})
