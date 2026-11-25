import {
  zCreateTopupRequest,
  zCreateTopupResponse
} from '@comfyorg/ingest-types/zod'
import { describe, expect, expectTypeOf, it } from 'vitest'
import type { z } from 'zod'

type TopupRequestBody = z.input<typeof zCreateTopupRequest>
type TopupRequest = z.infer<typeof zCreateTopupRequest>
type TopupResponseBody = z.input<typeof zCreateTopupResponse>
type TopupResponse = z.infer<typeof zCreateTopupResponse>

const MINIMUM_AMOUNT_CENTS = 500
const INT64_MAX = 9223372036854775807n

function topupRequest(): TopupRequestBody {
  return { amount_cents: BigInt(MINIMUM_AMOUNT_CENTS) }
}

function topupResponse(
  overrides: Partial<TopupResponseBody> = {}
): TopupResponseBody {
  return {
    amount_cents: BigInt(MINIMUM_AMOUNT_CENTS),
    billing_op_id: 'op-1',
    status: 'pending',
    topup_id: 'topup-1',
    ...overrides
  }
}

const TOPUP_STATUSES = [
  'pending',
  'completed',
  'failed'
] as const satisfies readonly TopupResponse['status'][]

// Compile-time pins: a regen that moves these fails the package typecheck.

// The amount the command validates, coerced to an int64 the transport never
// serializes, and the idempotency key it mints per attempt.
expectTypeOf<TopupRequest['amount_cents']>().toEqualTypeOf<bigint>()
expectTypeOf<TopupRequest['idempotency_key']>().toEqualTypeOf<
  string | undefined
>()
// The table above is exhaustive, so a new status reaches an `it.for` row.
expectTypeOf<TopupResponse['status']>().toEqualTypeOf<
  (typeof TOPUP_STATUSES)[number]
>()
expectTypeOf<TopupResponse['billing_op_id']>().toEqualTypeOf<string>()

describe('topup contract', () => {
  it('accepts a request carrying only the amount', () => {
    expect(zCreateTopupRequest.safeParse(topupRequest())).toMatchObject({
      success: true
    })
  })

  it('validates the JSON number the command sends and coerces it to an int64 the transport never serializes', () => {
    const parsed = zCreateTopupRequest.safeParse({
      amount_cents: MINIMUM_AMOUNT_CENTS
    })

    expect(parsed.success && parsed.data.amount_cents).toBe(
      BigInt(MINIMUM_AMOUNT_CENTS)
    )
  })

  it('rejects an amount below the minimum the command reports as invalid', () => {
    const below = { amount_cents: MINIMUM_AMOUNT_CENTS - 1 }

    expect(zCreateTopupRequest.safeParse(below).success).toBe(false)
    expect(
      zCreateTopupRequest.safeParse({ amount_cents: MINIMUM_AMOUNT_CENTS })
    ).toMatchObject({ success: true })
  })

  it('rejects an amount past the int64 ceiling the command reports as invalid', () => {
    expect(
      zCreateTopupRequest.safeParse({ amount_cents: INT64_MAX })
    ).toMatchObject({ success: true })
    expect(
      zCreateTopupRequest.safeParse({ amount_cents: INT64_MAX + 1n }).success
    ).toBe(false)
  })

  it('coerces the JSON number the wire carries for the response amount', () => {
    const parsed = zCreateTopupResponse.safeParse({
      ...topupResponse(),
      amount_cents: MINIMUM_AMOUNT_CENTS
    })

    expect(parsed.success && parsed.data.amount_cents).toBe(
      BigInt(MINIMUM_AMOUNT_CENTS)
    )
  })

  it('bounds the response amount to the int64 range', () => {
    const parseAmount = (amount_cents: bigint) =>
      zCreateTopupResponse.safeParse({ ...topupResponse(), amount_cents })

    expect(parseAmount(INT64_MAX)).toMatchObject({ success: true })
    expect(parseAmount(-INT64_MAX - 1n)).toMatchObject({ success: true })
    expect(parseAmount(INT64_MAX + 1n).success).toBe(false)
    expect(parseAmount(-INT64_MAX - 2n).success).toBe(false)
  })

  it.for(TOPUP_STATUSES)(
    'carries the operation id alongside the %s status',
    (status) => {
      const parsed = zCreateTopupResponse.safeParse(topupResponse({ status }))

      expect(parsed.success && parsed.data.billing_op_id).toBe('op-1')
    }
  )
})
