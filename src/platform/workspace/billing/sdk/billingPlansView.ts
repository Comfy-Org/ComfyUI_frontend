import type { BillingPlansData } from '@comfyorg/account-core/billing'

import type {
  BillingPlansResponse,
  Plan,
  TeamCreditStops
} from '@/platform/workspace/api/workspaceApi'

type DecodedPlan = BillingPlansData['plans'][number]
type DecodedStops = NonNullable<BillingPlansData['team_credit_stops']>
type DecodedStop = DecodedStops['stops'][number]

/**
 * The generated zod schema coerces every int64 in the catalog to `bigint` —
 * prices, credits, seat caps, the credit-stop ladder — while the generated
 * type the pricing surfaces read them through says `number`. All of them are
 * cents, credits or seat counts bounded far inside the safe range, so they are
 * read back as numbers the way the core reads cents and the capability
 * revision. Nothing is filtered, ranked or priced here.
 */
function projectPlan(plan: DecodedPlan): Plan {
  return {
    ...plan,
    credits_cents: Number(plan.credits_cents),
    max_seats: Number(plan.max_seats),
    price_cents: Number(plan.price_cents),
    seat_summary: {
      seat_count: plan.seat_summary.seat_count,
      total_cost_cents: Number(plan.seat_summary.total_cost_cents),
      total_credits_cents: Number(plan.seat_summary.total_credits_cents)
    }
  }
}

function projectStop(stop: DecodedStop): TeamCreditStops['stops'][number] {
  return {
    id: stop.id,
    credits: Number(stop.credits),
    monthly: {
      list_price_cents: Number(stop.monthly.list_price_cents),
      price_cents: Number(stop.monthly.price_cents)
    },
    yearly: {
      list_price_cents: Number(stop.yearly.list_price_cents),
      price_cents: Number(stop.yearly.price_cents)
    }
  }
}

/** The SDK's decoded catalog in the shape the host's plan state holds. */
export function projectBillingPlans(
  data: BillingPlansData
): BillingPlansResponse {
  const { team_credit_stops, ...rest } = data
  return {
    ...rest,
    plans: data.plans.map(projectPlan),
    ...(team_credit_stops === undefined
      ? {}
      : {
          team_credit_stops: {
            default_stop_index: team_credit_stops.default_stop_index,
            stops: team_credit_stops.stops.map(projectStop)
          }
        })
  }
}
