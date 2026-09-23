import type { BillingPlansData } from '@comfyorg/account-core/billing'

import type {
  BillingPlansResponse,
  Plan,
  TeamCreditStops
} from '@/platform/workspace/api/workspaceApi'

import { asSafeNumber } from './safeInt64'

type DecodedPlan = BillingPlansData['plans'][number]
type DecodedStops = NonNullable<BillingPlansData['team_credit_stops']>
type DecodedStop = DecodedStops['stops'][number]
type StopPrice = TeamCreditStops['stops'][number]['monthly']

/**
 * The generated zod schema coerces every int64 in the catalog to `bigint` —
 * prices, credits, seat caps, the credit-stop ladder — while the generated
 * type the pricing surfaces read them through says `number`. Each is read
 * back as a number when a number holds it exactly; one that does not fails
 * the whole projection, so a catalog is never published with a rounded price.
 * Nothing is filtered, ranked or priced here.
 */
function projectPlan(plan: DecodedPlan): Plan | undefined {
  const credits_cents = asSafeNumber(plan.credits_cents)
  const max_seats = asSafeNumber(plan.max_seats)
  const price_cents = asSafeNumber(plan.price_cents)
  const total_cost_cents = asSafeNumber(plan.seat_summary.total_cost_cents)
  const total_credits_cents = asSafeNumber(
    plan.seat_summary.total_credits_cents
  )
  if (
    credits_cents === undefined ||
    max_seats === undefined ||
    price_cents === undefined ||
    total_cost_cents === undefined ||
    total_credits_cents === undefined
  )
    return undefined
  return {
    ...plan,
    credits_cents,
    max_seats,
    price_cents,
    seat_summary: {
      seat_count: plan.seat_summary.seat_count,
      total_cost_cents,
      total_credits_cents
    }
  }
}

function projectStopPrice(
  price: DecodedStop['monthly']
): StopPrice | undefined {
  const list_price_cents = asSafeNumber(price.list_price_cents)
  const price_cents = asSafeNumber(price.price_cents)
  if (list_price_cents === undefined || price_cents === undefined)
    return undefined
  return { list_price_cents, price_cents }
}

function projectStop(
  stop: DecodedStop
): TeamCreditStops['stops'][number] | undefined {
  const credits = asSafeNumber(stop.credits)
  const monthly = projectStopPrice(stop.monthly)
  const yearly = projectStopPrice(stop.yearly)
  if (credits === undefined || monthly === undefined || yearly === undefined)
    return undefined
  return { id: stop.id, credits, monthly, yearly }
}

function projectAll<T, U>(
  items: readonly T[],
  project: (item: T) => U | undefined
): U[] | undefined {
  const projected: U[] = []
  for (const item of items) {
    const result = project(item)
    if (result === undefined) return undefined
    projected.push(result)
  }
  return projected
}

/**
 * The SDK's decoded catalog in the shape the host's plan state holds, or
 * undefined when a value in it cannot be held exactly.
 */
export function projectBillingPlans(
  data: BillingPlansData
): BillingPlansResponse | undefined {
  const { team_credit_stops, ...rest } = data
  const plans = projectAll(data.plans, projectPlan)
  if (plans === undefined) return undefined
  if (team_credit_stops === undefined) return { ...rest, plans }
  const stops = projectAll(team_credit_stops.stops, projectStop)
  if (stops === undefined) return undefined
  return {
    ...rest,
    plans,
    team_credit_stops: {
      default_stop_index: team_credit_stops.default_stop_index,
      stops
    }
  }
}
