import { zBillingBalanceResponse } from '@comfyorg/ingest-types/zod'
import { describe, expect, expectTypeOf, it } from 'vitest'
import type { z } from 'zod'

type BalanceBody = z.input<typeof zBillingBalanceResponse>
type Balance = z.infer<typeof zBillingBalanceResponse>

function balanceBody(overrides: Partial<BalanceBody> = {}): BalanceBody {
  return {
    amount_micros: 12_500_000,
    currency: 'usd',
    ...overrides
  }
}

// Compile-time pins: a regen that moves these fails the package typecheck.
expectTypeOf<Balance['amount_micros']>().toEqualTypeOf<number>()
expectTypeOf<
  Pick<
    Balance,
    | 'cloud_credit_balance_micros'
    | 'effective_balance_micros'
    | 'pending_charges_micros'
    | 'prepaid_balance_micros'
  >
>().toEqualTypeOf<{
  cloud_credit_balance_micros?: number
  effective_balance_micros?: number
  pending_charges_micros?: number
  prepaid_balance_micros?: number
}>()

describe('billing balance contract', () => {
  it('accepts a balance carrying only the required fields', () => {
    expect(zBillingBalanceResponse.safeParse(balanceBody())).toMatchObject({
      success: true
    })
  })

  it('keeps every balance breakdown optional beside the headline amount', () => {
    const breakdown = balanceBody({
      cloud_credit_balance_micros: 1,
      effective_balance_micros: 2,
      pending_charges_micros: 3,
      prepaid_balance_micros: 4
    })

    expect(zBillingBalanceResponse.safeParse(breakdown)).toMatchObject({
      success: true
    })
  })
})
