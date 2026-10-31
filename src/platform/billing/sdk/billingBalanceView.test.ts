import { describe, expect, it } from 'vitest'

import type { BillingBalance } from '@comfyorg/account-core/billing'

import { projectBillingBalance } from './billingBalanceView'

const TOO_LARGE = BigInt(Number.MAX_SAFE_INTEGER) + 1n

const BALANCE: BillingBalance = {
  amount_micros: 5_000_000,
  currency: 'usd'
}

describe('projectBillingBalance', () => {
  it('reads the top-up cap back as numbers', () => {
    expect(
      projectBillingBalance({
        ...BALANCE,
        max_topup_cents: 100_000n,
        max_topup_credits: 211_000n
      })
    ).toStrictEqual({
      ...BALANCE,
      max_topup_cents: 100_000,
      max_topup_credits: 211_000
    })
  })

  it('reads the top-up minimum back as numbers', () => {
    expect(
      projectBillingBalance({
        ...BALANCE,
        min_topup_cents: 500n,
        min_topup_credits: 1_055n
      })
    ).toStrictEqual({
      ...BALANCE,
      min_topup_cents: 500,
      min_topup_credits: 1_055
    })
  })

  it.for([
    { field: 'min_topup_cents', cents: TOO_LARGE, credits: 1_055n },
    { field: 'min_topup_credits', cents: 500n, credits: TOO_LARGE }
  ])(
    'drops only the top-up minimum when $field is past what a number holds exactly',
    ({ cents, credits }) => {
      expect(
        projectBillingBalance({
          ...BALANCE,
          max_topup_cents: 100_000n,
          max_topup_credits: 211_000n,
          min_topup_cents: cents,
          min_topup_credits: credits
        })
      ).toStrictEqual({
        ...BALANCE,
        max_topup_cents: 100_000,
        max_topup_credits: 211_000
      })
    }
  )

  it.for([
    { field: 'max_topup_cents', cents: TOO_LARGE, credits: 211_000n },
    { field: 'max_topup_credits', cents: 100_000n, credits: TOO_LARGE }
  ])(
    'drops the whole top-up cap when $field is past what a number holds exactly',
    ({ cents, credits }) => {
      expect(
        projectBillingBalance({
          ...BALANCE,
          max_topup_cents: cents,
          max_topup_credits: credits
        })
      ).toStrictEqual(BALANCE)
    }
  )

  it('carries a balance with no top-up cap through untouched', () => {
    expect(projectBillingBalance(BALANCE)).toStrictEqual(BALANCE)
  })
})
