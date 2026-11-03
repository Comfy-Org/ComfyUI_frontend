import type { SubscriptionPreview } from '@comfyorg/account-core/billing'

type PlanInfo = SubscriptionPreview['new_plan']

export function plan(
  tier: PlanInfo['tier'],
  duration: PlanInfo['duration'],
  priceCents: number,
  periodEnd?: string
): PlanInfo {
  return {
    slug: `${tier.toLowerCase()}-${duration.toLowerCase()}`,
    tier,
    duration,
    price_cents: priceCents,
    credits_cents: 0,
    seat_summary: {
      seat_count: 1,
      total_cost_cents: priceCents,
      total_credits_cents: 0
    },
    ...(periodEnd && { period_end: periodEnd })
  }
}

/** The shape served while embedded checkout is off: legacy costs only. */
export function legacyPreview(
  overrides: Partial<SubscriptionPreview> = {}
): SubscriptionPreview {
  return {
    allowed: true,
    transition_type: 'new_subscription',
    effective_at: '2026-06-19T00:00:00Z',
    is_immediate: true,
    cost_today_cents: 2000,
    cost_next_period_cents: 3000,
    credits_today_cents: 0,
    credits_next_period_cents: 0,
    new_plan: plan('CREATOR', 'MONTHLY', 2000),
    ...overrides
  }
}

export function exactPreview(
  overrides: Partial<SubscriptionPreview> = {}
): SubscriptionPreview {
  return legacyPreview({
    quote_id: 'quote_123',
    quote_version: 1,
    amount_due_cents: 1500,
    currency: 'usd',
    renewal_amount_cents: 2500,
    renewal_at: '2026-07-19T00:00:00Z',
    ...overrides
  })
}
