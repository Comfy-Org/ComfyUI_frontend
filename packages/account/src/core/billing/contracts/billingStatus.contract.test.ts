import { zBillingStatusResponse } from '@comfyorg/ingest-types/zod'
import { describe, expect, expectTypeOf, it } from 'vitest'
import type { z } from 'zod'

type StatusBody = z.input<typeof zBillingStatusResponse>
type Status = z.infer<typeof zBillingStatusResponse>

function statusBody(overrides: Partial<StatusBody> = {}): StatusBody {
  return {
    has_funds: true,
    is_active: true,
    max_seats: 5,
    occupied_seats: 1,
    scheduled_change: null,
    team_credit_stop: null,
    ...overrides
  }
}

/** Every rail presentation routing distinguishes; only 'stripe' reaches the embedded challenge. */
const BILLING_RAILS = [
  'legacy_stripe',
  'metronome',
  'stripe'
] as const satisfies readonly NonNullable<Status['billing_rail']>[]

/** Every kind the lifecycle adopts from a server-reported pending operation. */
const PENDING_OP_TYPES = [
  'subscription',
  'topup'
] as const satisfies readonly NonNullable<Status['pending_billing_op_type']>[]

/** Every value subscribe eligibility distinguishes; only 'canceled' reroutes to resubscribe. */
const SUBSCRIPTION_STATUSES = [
  'active',
  'ended',
  'canceled'
] as const satisfies readonly NonNullable<Status['subscription_status']>[]

describe('billing status contract', () => {
  it('accepts a status carrying only the required fields', () => {
    expect(zBillingStatusResponse.safeParse(statusBody())).toMatchObject({
      success: true
    })
  })

  it('carries the three rails presentation routing distinguishes', () => {
    expectTypeOf<Status['billing_rail']>().toEqualTypeOf<
      'legacy_stripe' | 'metronome' | 'stripe' | undefined
    >()
  })

  it.for(BILLING_RAILS)('accepts the %s rail', (billing_rail) => {
    expect(
      zBillingStatusResponse.safeParse(statusBody({ billing_rail }))
    ).toMatchObject({ success: true })
  })

  it('names the pending operation the lifecycle reattaches to', () => {
    expectTypeOf<Status['pending_billing_op_id']>().toEqualTypeOf<
      string | undefined
    >()
    expectTypeOf<Status['pending_billing_op_type']>().toEqualTypeOf<
      'subscription' | 'topup' | undefined
    >()
  })

  it.for(PENDING_OP_TYPES)(
    'accepts a pending %s operation',
    (pending_billing_op_type) => {
      const body = statusBody({
        pending_billing_op_id: 'op-1',
        pending_billing_op_type
      })

      expect(zBillingStatusResponse.safeParse(body)).toMatchObject({
        success: true
      })
    }
  )

  it('carries the continuations the lifecycle adopts alongside a pending operation', () => {
    expectTypeOf<Status['action_url']>().toEqualTypeOf<string | undefined>()
    expectTypeOf<Status['payment_intent_client_secret']>().toEqualTypeOf<
      string | undefined
    >()
  })

  it('reports subscription eligibility as an active flag, a tier, and a status', () => {
    expectTypeOf<Status['is_active']>().toEqualTypeOf<boolean>()
    expectTypeOf<Status['subscription_status']>().toEqualTypeOf<
      'active' | 'ended' | 'canceled' | undefined
    >()
    expectTypeOf<Status['subscription_tier']>().toEqualTypeOf<
      | 'FREE'
      | 'STANDARD'
      | 'CREATOR'
      | 'PRO'
      | 'FOUNDERS_EDITION'
      | 'TEAM'
      | 'ENTERPRISE'
      | undefined
    >()
  })

  it.for(SUBSCRIPTION_STATUSES)(
    'accepts the %s subscription status',
    (subscription_status) => {
      const body = statusBody({
        subscription_status,
        subscription_tier: 'PRO'
      })

      expect(zBillingStatusResponse.safeParse(body)).toMatchObject({
        success: true
      })
    }
  )

  it('keeps FREE in the tier set eligibility reads as unpaid', () => {
    const body = statusBody({ subscription_tier: 'FREE' })

    expect(zBillingStatusResponse.safeParse(body)).toMatchObject({
      success: true
    })
  })
})
