export interface CreditStop {
  /** Monthly subscription price in USD. */
  usd: number
  /** Monthly credit grant at this stop. */
  credits: number
}

/**
 * Team-plan credit-subscription slider stops.
 *
 * Hardcoded per Figma DES-197 (Updates to PricingTable dialog): the team-plan
 * credit slider snaps to exactly these 5 fixed breakpoints — the user cannot
 * select a value in between. The `credits` figures equal `usdToCredits(usd)` at
 * the current rate (`CREDITS_PER_USD = 211`); a unit test guards against rate
 * drift silently changing the designed values.
 *
 * TODO(FE-934): once the backend slider contract lands, these stops will come
 * from `GET /api/billing/plans` instead of being hardcoded here.
 */
export const TEAM_PLAN_CREDIT_STOPS: readonly CreditStop[] = [
  { usd: 200, credits: 42_200 },
  { usd: 400, credits: 84_400 },
  { usd: 700, credits: 147_700 },
  { usd: 1_400, credits: 295_400 },
  { usd: 2_500, credits: 527_500 }
] as const

/** Default stop per DES-197: index 2 = $700 / 147,700 credits. */
export const DEFAULT_TEAM_PLAN_STOP_INDEX = 2
