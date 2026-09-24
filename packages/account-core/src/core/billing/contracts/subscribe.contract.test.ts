import {
  zSubscribeRequest,
  zSubscribeResponse
} from '@comfyorg/ingest-types/zod'
import { describe, expect, expectTypeOf, it } from 'vitest'
import type { z } from 'zod'

type SubscribeRequestBody = z.input<typeof zSubscribeRequest>
type SubscribeRequest = z.infer<typeof zSubscribeRequest>
type SubscribeResponseBody = z.input<typeof zSubscribeResponse>
type SubscribeResponse = z.infer<typeof zSubscribeResponse>

function subscribeRequest(
  overrides: Partial<SubscribeRequestBody> = {}
): SubscribeRequestBody {
  return { plan_slug: 'pro_monthly', ...overrides }
}

function subscribeResponse(
  overrides: Partial<SubscribeResponseBody> = {}
): SubscribeResponseBody {
  return { billing_op_id: 'op-1', status: 'subscribed', ...overrides }
}

/** Every outcome the command distinguishes; only 'needs_payment_method' demands a hosted page. */
const SUBSCRIBE_STATUSES = [
  'subscribed',
  'needs_payment_method',
  'pending_payment'
] as const satisfies readonly SubscribeResponse['status'][]

// Compile-time pins: a regen that moves these fails the package typecheck.

// The payment credentials the command deconflicts before sending.
expectTypeOf<SubscribeRequest['confirmation_token']>().toEqualTypeOf<
  string | undefined
>()
expectTypeOf<SubscribeRequest['saved_payment_method_id']>().toEqualTypeOf<
  string | undefined
>()
expectTypeOf<SubscribeRequest['idempotency_key']>().toEqualTypeOf<
  string | undefined
>()
expectTypeOf<SubscribeRequest['confirm_reactivation']>().toEqualTypeOf<
  boolean | undefined
>()
// The table above is exhaustive, so a new outcome reaches an `it.for` row.
expectTypeOf<SubscribeResponse['status']>().toEqualTypeOf<
  (typeof SUBSCRIBE_STATUSES)[number]
>()
expectTypeOf<SubscribeResponse['billing_op_id']>().toEqualTypeOf<string>()
expectTypeOf<SubscribeResponse['payment_method_url']>().toEqualTypeOf<
  string | undefined
>()

describe('subscribe contract', () => {
  it('accepts a request carrying only the plan slug', () => {
    expect(zSubscribeRequest.safeParse(subscribeRequest())).toMatchObject({
      success: true
    })
  })

  it('rejects a saved payment method that is not a Stripe payment-method id', () => {
    const rejected = subscribeRequest({ saved_payment_method_id: 'card_123' })
    const accepted = subscribeRequest({ saved_payment_method_id: 'pm_123' })

    expect(zSubscribeRequest.safeParse(rejected).success).toBe(false)
    expect(zSubscribeRequest.safeParse(accepted)).toMatchObject({
      success: true
    })
  })

  it('accepts the reactivation confirmation the server asks callers to resend', () => {
    const body = subscribeRequest({ confirm_reactivation: true })

    expect(zSubscribeRequest.safeParse(body)).toMatchObject({ success: true })
  })

  it.for(SUBSCRIBE_STATUSES)('accepts the %s outcome', (status) => {
    expect(
      zSubscribeResponse.safeParse(subscribeResponse({ status }))
    ).toMatchObject({ success: true })
  })

  it('leaves the hosted payment page optional, which the command reads as a missing url', () => {
    const parsed = zSubscribeResponse.safeParse(
      subscribeResponse({ status: 'needs_payment_method' })
    )

    expect(parsed.success && parsed.data.payment_method_url).toBeUndefined()
  })
})
