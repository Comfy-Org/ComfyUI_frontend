import {
  zCreateTopupCheckoutRequest,
  zCreateTopupCheckoutResponse
} from '@comfyorg/ingest-types/zod'
import { describe, expect, expectTypeOf, it } from 'vitest'
import type { z } from 'zod'

type CheckoutRequestBody = z.input<typeof zCreateTopupCheckoutRequest>
type CheckoutRequest = z.infer<typeof zCreateTopupCheckoutRequest>
type CheckoutResponseBody = z.input<typeof zCreateTopupCheckoutResponse>
type CheckoutResponse = z.infer<typeof zCreateTopupCheckoutResponse>

const MINIMUM_AMOUNT_CENTS = 500
const MAXIMUM_AMOUNT_CENTS = 473_900
const RETURN_URL = 'https://app.comfy.org/billing/return'

function checkoutRequest(
  overrides: Partial<CheckoutRequestBody> = {}
): CheckoutRequestBody {
  return {
    amount_cents: BigInt(MINIMUM_AMOUNT_CENTS),
    return_url: RETURN_URL,
    ...overrides
  }
}

function checkoutResponse(
  overrides: Partial<CheckoutResponseBody> = {}
): CheckoutResponseBody {
  return {
    checkout_url: 'https://checkout.stripe.com/c/session-1',
    ...overrides
  }
}

/**
 * The command tells an invalid amount from an invalid return url by the
 * issue's own path, so the field names are part of the contract.
 */
const INVALID_REQUESTS = [
  {
    rejected: 'an amount below the minimum',
    field: 'amount_cents',
    body: { amount_cents: MINIMUM_AMOUNT_CENTS - 1, return_url: RETURN_URL }
  },
  {
    rejected: 'an amount above the maximum',
    field: 'amount_cents',
    body: { amount_cents: MAXIMUM_AMOUNT_CENTS + 1, return_url: RETURN_URL }
  },
  {
    rejected: 'a return url that is not a url',
    field: 'return_url',
    body: { amount_cents: MINIMUM_AMOUNT_CENTS, return_url: 'not-a-url' }
  }
] as const

describe('hosted topup checkout contract', () => {
  it('accepts a request carrying an in-range amount and a return url', () => {
    expect(
      zCreateTopupCheckoutRequest.safeParse(checkoutRequest())
    ).toMatchObject({ success: true })
    expect(
      zCreateTopupCheckoutRequest.safeParse({
        amount_cents: MAXIMUM_AMOUNT_CENTS,
        return_url: RETURN_URL
      })
    ).toMatchObject({ success: true })
  })

  it('coerces the JSON amount to an int64 the transport never serializes', () => {
    expectTypeOf<CheckoutRequest['amount_cents']>().toEqualTypeOf<bigint>()

    const parsed = zCreateTopupCheckoutRequest.safeParse({
      amount_cents: MINIMUM_AMOUNT_CENTS,
      return_url: RETURN_URL
    })

    expect(parsed.success && parsed.data.amount_cents).toBe(
      BigInt(MINIMUM_AMOUNT_CENTS)
    )
  })

  it.for(INVALID_REQUESTS)('blames $field for $rejected', ({ field, body }) => {
    const parsed = zCreateTopupCheckoutRequest.safeParse(body)
    const paths = parsed.success
      ? []
      : parsed.error.issues.map((issue) => issue.path[0])

    expect(paths).toContain(field)
  })

  it('returns the hosted page the command still re-checks for https itself', () => {
    expectTypeOf<CheckoutResponse['checkout_url']>().toEqualTypeOf<string>()
    expect(
      zCreateTopupCheckoutResponse.safeParse(checkoutResponse())
    ).toMatchObject({ success: true })
    expect(zCreateTopupCheckoutResponse.safeParse({}).success).toBe(false)
  })

  it('leaves the provider session id optional, so the host correlates only when it is sent', () => {
    expectTypeOf<CheckoutResponse['session_id']>().toEqualTypeOf<
      string | undefined
    >()

    const parsed = zCreateTopupCheckoutResponse.safeParse(checkoutResponse())

    expect(parsed.success && parsed.data.session_id).toBeUndefined()
  })
})
