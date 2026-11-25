import {
  CREDITS_PER_USD as ACCOUNT_CORE_CREDITS_PER_USD,
  creditsToCents as accountCoreCreditsToCents
} from '@comfyorg/account-core/billing'
import {
  CREDITS_PER_USD as SHARED_CREDITS_PER_USD,
  creditsToCents as sharedCreditsToCents
} from '@comfyorg/shared-frontend-utils/creditsUtil'
import { describe, expect, it } from 'vitest'

describe('credits rate parity between account-core and shared utils', () => {
  it('declares the same credits-per-dollar rate in both packages', () => {
    expect(ACCOUNT_CORE_CREDITS_PER_USD).toBe(SHARED_CREDITS_PER_USD)
  })

  it.for([0, 1, 2, 105, 211, 1_000, 2_110, 10_550, 999_999])(
    'prices %i credits at the same whole cents in both packages',
    (credits) => {
      expect(Math.round(accountCoreCreditsToCents(credits))).toBe(
        sharedCreditsToCents(credits)
      )
    }
  )
})
