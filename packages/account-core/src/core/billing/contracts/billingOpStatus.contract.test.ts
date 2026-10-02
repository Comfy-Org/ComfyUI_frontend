import { zBillingOpStatusResponse } from '@comfyorg/ingest-types/zod'
import { describe, expect, expectTypeOf, it } from 'vitest'
import type { z } from 'zod'

import { BillingOpStatusSchema } from '../operationState.js'

type OpStatusBody = z.input<typeof zBillingOpStatusResponse>
type OpStatus = z.infer<typeof zBillingOpStatusResponse>

function opStatusBody(overrides: Partial<OpStatusBody> = {}): OpStatusBody {
  return {
    id: 'op-1',
    started_at: '2024-06-15T12:00:00.000Z',
    status: 'pending',
    ...overrides
  }
}

/** Every value the reducer distinguishes; 'pending' is its stay-put branch. */
const REDUCED_STATUSES = [
  'pending',
  'succeeded',
  'failed',
  'reconciliation_needed'
] as const satisfies readonly OpStatus['status'][]

/** Every value the pending reducer reads or `settleChallenge` assigns. */
const AUTHENTICATION_STATES = [
  'requires_action',
  'processing',
  'failed_retryable',
  'succeeded',
  'reconciliation_needed'
] as const satisfies readonly NonNullable<OpStatus['authentication_state']>[]

// Compile-time pins: a regen that moves these fails the package typecheck.

// The tables above are exhaustive, so a new member reaches an `it.for` row.
expectTypeOf<OpStatus['status']>().toEqualTypeOf<
  (typeof REDUCED_STATUSES)[number]
>()
expectTypeOf<OpStatus['authentication_state']>().toEqualTypeOf<
  (typeof AUTHENTICATION_STATES)[number] | undefined
>()
// The recovery actions a host offers after a decline.
expectTypeOf<OpStatus['recovery_action']>().toEqualTypeOf<
  | 'retry'
  | 'replace_payment_method'
  | 'authenticate_payment'
  | 'contact_support'
  | undefined
>()
// The server phases the pending state mirrors.
expectTypeOf<OpStatus['phase']>().toEqualTypeOf<
  | 'awaiting_payment_method'
  | 'awaiting_invoice_payment'
  | 'in_progress'
  | undefined
>()
expectTypeOf<OpStatus['id']>().toEqualTypeOf<string>()
expectTypeOf<OpStatus['action_url']>().toEqualTypeOf<string | undefined>()
expectTypeOf<OpStatus['payment_intent_client_secret']>().toEqualTypeOf<
  string | undefined
>()
expectTypeOf<OpStatus['retryable']>().toEqualTypeOf<boolean | undefined>()

describe('billing operation status contract', () => {
  it.for(['amount_charged_cents', 'credits_added'] as const)(
    'normalizes %s to a number',
    (field) => {
      expect(
        BillingOpStatusSchema.safeParse(
          opStatusBody({ status: 'succeeded', [field]: 1999 })
        )
      ).toMatchObject({ success: true, data: { [field]: 1999 } })
    }
  )

  it('normalizes charge breakdown amounts to numbers', () => {
    expect(
      BillingOpStatusSchema.safeParse(
        {
          ...opStatusBody({ status: 'succeeded' }),
          charge_breakdown: {
            amount_charged_cents: 1999,
            currency: 'usd',
            prorated: true,
            reasons: [
              {
                amount_cents: 500,
                discount: {
                  amount_off_cents: 500,
                  code: 'SAVE',
                  duration_in_months: 3,
                  kind: 'promotion'
                },
                kind: 'promo_code'
              }
            ]
          }
        }
      )
    ).toMatchObject({
      success: true,
      data: {
        charge_breakdown: {
          amount_charged_cents: 1999,
          reasons: [
            {
              amount_cents: 500,
              discount: { amount_off_cents: 500, duration_in_months: 3 }
            }
          ]
        }
      }
    })
  })

  it('accepts a status carrying only the required fields', () => {
    expect(zBillingOpStatusResponse.safeParse(opStatusBody())).toMatchObject({
      success: true
    })
  })

  it('requires a datetime start time, so a malformed one fails the whole poll', () => {
    expect(
      zBillingOpStatusResponse.safeParse(
        opStatusBody({ started_at: 'not-a-date' })
      ).success
    ).toBe(false)
  })

  it.for(REDUCED_STATUSES)('accepts the %s status', (status) => {
    expect(
      zBillingOpStatusResponse.safeParse(opStatusBody({ status }))
    ).toMatchObject({ success: true })
  })

  it.for(AUTHENTICATION_STATES)(
    'accepts the %s authentication state',
    (authentication_state) => {
      expect(
        zBillingOpStatusResponse.safeParse(
          opStatusBody({ authentication_state })
        )
      ).toMatchObject({ success: true })
    }
  )

  it('leaves retryable absent by default, so a decline is not retryable unless the server says so', () => {
    const parsed = zBillingOpStatusResponse.safeParse(
      opStatusBody({ status: 'failed' })
    )

    expect(parsed.success && parsed.data.retryable).toBeUndefined()
  })
})
