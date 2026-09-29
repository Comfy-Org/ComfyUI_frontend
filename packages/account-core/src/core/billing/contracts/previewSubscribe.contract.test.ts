import {
  zPreviewSubscribeRequest,
  zPreviewSubscribeResponse
} from '@comfyorg/ingest-types/zod'
import { describe, expect, expectTypeOf, it } from 'vitest'
import type { z } from 'zod'

type PreviewRequestBody = z.input<typeof zPreviewSubscribeRequest>
type PreviewRequest = z.infer<typeof zPreviewSubscribeRequest>
type PreviewResponseBody = z.input<typeof zPreviewSubscribeResponse>
type PreviewResponse = z.infer<typeof zPreviewSubscribeResponse>

function previewRequest(
  overrides: Partial<PreviewRequestBody> = {}
): PreviewRequestBody {
  return { plan_slug: 'pro_monthly', ...overrides }
}

const planInfo: PreviewResponseBody['new_plan'] = {
  credits_cents: 2000n,
  duration: 'MONTHLY',
  price_cents: 3000n,
  seat_summary: {
    seat_count: 1,
    total_cost_cents: 3000n,
    total_credits_cents: 2000n
  },
  slug: 'pro_monthly',
  tier: 'PRO'
}

function previewResponse(
  overrides: Partial<PreviewResponseBody> = {}
): PreviewResponseBody {
  return {
    allowed: true,
    cost_next_period_cents: 3000n,
    cost_today_cents: 3000n,
    credits_next_period_cents: 2000n,
    credits_today_cents: 2000n,
    effective_at: '2024-06-15T12:00:00.000Z',
    is_immediate: true,
    new_plan: planInfo,
    transition_type: 'new_subscription',
    ...overrides
  }
}

/** Every transition the quote can describe; a host renders all four. */
const TRANSITION_TYPES = [
  'new_subscription',
  'upgrade',
  'downgrade',
  'duration_change'
] as const satisfies readonly PreviewResponse['transition_type'][]

/** Every amount the quote can carry, each one the host formats as money. */
const MONEY_FIELDS = [
  'amount_due_cents',
  'cost_next_period_cents',
  'cost_today_cents',
  'credits_next_period_cents',
  'credits_today_cents',
  'renewal_amount_cents'
] as const satisfies readonly (keyof PreviewResponseBody)[]

const INT64_MIN = -9223372036854775808n
const INT64_MAX = 9223372036854775807n

// Compile-time pins: a regen that moves these fails the package typecheck.

// The money table above is exhaustive, so a seventh amount reaches both the
// coercion rows and the int64 rows.
expectTypeOf<(typeof MONEY_FIELDS)[number]>().toEqualTypeOf<
  Extract<keyof PreviewResponseBody, `${string}_cents`>
>()
// The plan slug is the only required request field.
expectTypeOf<PreviewRequest>().toEqualTypeOf<{
  plan_slug: string
  checkout_attempt_id?: string
  promotion_code?: string
  team_credit_stop_id?: string
}>()
// The transition table above is exhaustive, so a new member reaches a row.
expectTypeOf<PreviewResponse['transition_type']>().toEqualTypeOf<
  (typeof TRANSITION_TYPES)[number]
>()
expectTypeOf<PreviewResponse['allowed']>().toEqualTypeOf<boolean>()
expectTypeOf<PreviewResponse['is_immediate']>().toEqualTypeOf<boolean>()
expectTypeOf<PreviewResponse['effective_at']>().toEqualTypeOf<string>()
// Money is an int64, so a host formats a bigint rather than a number.
expectTypeOf<PreviewResponse['cost_today_cents']>().toEqualTypeOf<bigint>()
expectTypeOf<
  PreviewResponse['cost_next_period_cents']
>().toEqualTypeOf<bigint>()
expectTypeOf<PreviewResponse['credits_today_cents']>().toEqualTypeOf<bigint>()
expectTypeOf<
  PreviewResponse['credits_next_period_cents']
>().toEqualTypeOf<bigint>()
expectTypeOf<PreviewResponse['amount_due_cents']>().toEqualTypeOf<
  bigint | undefined
>()
expectTypeOf<PreviewResponse['renewal_amount_cents']>().toEqualTypeOf<
  bigint | undefined
>()
// The reactivation confirmation the subscribe command is asked to resend.
expectTypeOf<
  PreviewResponse['requires_reactivation_confirmation']
>().toEqualTypeOf<boolean | undefined>()

describe('preview subscribe contract', () => {
  it('accepts the request the command builds from its camel-cased input', () => {
    const body = previewRequest({
      checkout_attempt_id: 'attempt-1',
      promotion_code: 'LAUNCH',
      team_credit_stop_id: 'stop-1'
    })

    expect(zPreviewSubscribeRequest.safeParse(body)).toMatchObject({
      success: true
    })
  })

  it('requires the plan slug', () => {
    expect(zPreviewSubscribeRequest.safeParse({}).success).toBe(false)
  })

  it('accepts a quote carrying only the required fields', () => {
    expect(
      zPreviewSubscribeResponse.safeParse(previewResponse())
    ).toMatchObject({ success: true })
  })

  it.for(TRANSITION_TYPES)('quotes the %s transition', (transition_type) => {
    const parsed = zPreviewSubscribeResponse.safeParse(
      previewResponse({ transition_type })
    )

    expect(parsed.success && parsed.data.transition_type).toBe(transition_type)
  })

  it('rejects an effective date a host could not read the change from', () => {
    expect(
      zPreviewSubscribeResponse.safeParse(
        previewResponse({ effective_at: 'not-a-date' })
      ).success
    ).toBe(false)
  })

  it.for(MONEY_FIELDS)(
    'coerces the JSON number the wire actually carries for %s',
    (field) => {
      const parsed = zPreviewSubscribeResponse.safeParse({
        ...previewResponse(),
        [field]: 3000
      })

      expect(parsed.success && parsed.data[field]).toBe(3000n)
    }
  )

  it.for(MONEY_FIELDS)('bounds %s to the int64 range', (field) => {
    const parseAmount = (amount: bigint) =>
      zPreviewSubscribeResponse.safeParse({
        ...previewResponse(),
        [field]: amount
      })

    expect(parseAmount(INT64_MIN)).toMatchObject({ success: true })
    expect(parseAmount(INT64_MAX)).toMatchObject({ success: true })
    expect(parseAmount(INT64_MIN - 1n).success).toBe(false)
    expect(parseAmount(INT64_MAX + 1n).success).toBe(false)
  })

  it('describes discounts as product copy the host renders rather than matches', () => {
    const body = previewResponse({
      discounts: [{ code: 'LAUNCH', kind: 'promotion', name: 'Launch offer' }]
    })
    const parsed = zPreviewSubscribeResponse.safeParse(body)

    expect(parsed.success && parsed.data.discounts?.[0]).toMatchObject({
      code: 'LAUNCH',
      kind: 'promotion'
    })
  })
})
