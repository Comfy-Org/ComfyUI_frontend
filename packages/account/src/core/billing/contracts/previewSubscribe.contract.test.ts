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

  it('requires the plan slug and leaves every other request field optional', () => {
    expectTypeOf<PreviewRequest>().toEqualTypeOf<{
      plan_slug: string
      checkout_attempt_id?: string
      promotion_code?: string
      team_credit_stop_id?: string
    }>()
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

  it('states whether the change is allowed and when it takes effect', () => {
    expectTypeOf<PreviewResponse['allowed']>().toEqualTypeOf<boolean>()
    expectTypeOf<PreviewResponse['is_immediate']>().toEqualTypeOf<boolean>()
    expectTypeOf<PreviewResponse['effective_at']>().toEqualTypeOf<string>()
  })

  it('reports money as an int64, so a host formats a bigint rather than a number', () => {
    expectTypeOf<PreviewResponse['cost_today_cents']>().toEqualTypeOf<bigint>()
    expectTypeOf<
      PreviewResponse['cost_next_period_cents']
    >().toEqualTypeOf<bigint>()
    expectTypeOf<
      PreviewResponse['credits_today_cents']
    >().toEqualTypeOf<bigint>()
    expectTypeOf<
      PreviewResponse['credits_next_period_cents']
    >().toEqualTypeOf<bigint>()
  })

  it('coerces the JSON numbers the wire actually carries for those amounts', () => {
    const wireBody = { ...previewResponse(), cost_today_cents: 3000 }
    const parsed = zPreviewSubscribeResponse.safeParse(wireBody)

    expect(parsed.success && parsed.data.cost_today_cents).toBe(3000n)
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

  it('flags the reactivation confirmation the subscribe command is asked to resend', () => {
    expectTypeOf<
      PreviewResponse['requires_reactivation_confirmation']
    >().toEqualTypeOf<boolean | undefined>()
  })
})
