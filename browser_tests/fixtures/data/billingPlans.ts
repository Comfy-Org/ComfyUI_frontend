import type { Plan } from '@comfyorg/ingest-types'

import { CREDITS_PER_USD } from '@/base/credits/comfyCredits'

const MONTHS_PER_DURATION = {
  MONTHLY: 1,
  ANNUAL: 12
} satisfies Record<Plan['duration'], number>

interface PlanFixtureOptions {
  slug: string
  tier: Plan['tier']
  duration: Plan['duration']
  priceCents: number
  monthlyCredits: number
  maxSeats?: number
  seatCount?: number
}

/**
 * The catalog carries the grant for the whole billing period in USD cents,
 * rounded up the way the backend seeds it (4,200 credits -> 1,991 cents).
 */
export function createPlan({
  slug,
  tier,
  duration,
  priceCents,
  monthlyCredits,
  maxSeats = 1,
  seatCount = 1
}: PlanFixtureOptions): Plan {
  const creditsCents = Math.ceil(
    (monthlyCredits * MONTHS_PER_DURATION[duration] * 100) / CREDITS_PER_USD
  )
  return {
    slug,
    tier,
    duration,
    price_cents: priceCents,
    credits_cents: creditsCents,
    max_seats: maxSeats,
    availability: { available: true },
    seat_summary: {
      seat_count: seatCount,
      total_cost_cents: priceCents * seatCount,
      total_credits_cents: creditsCents * seatCount
    }
  }
}
