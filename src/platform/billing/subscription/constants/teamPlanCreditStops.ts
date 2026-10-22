export interface CreditStop {
  /** Backend stop identifier (e.g. "team_700"), sent on subscribe. Present for
   *  API-sourced stops; absent only for the hardcoded OSS / pre-deploy fallback. */
  id?: string
  /** Monthly subscription price in USD (pre-discount). */
  usd: number
  /** Monthly credit grant at this stop. */
  credits: number
  /**
   * Yearly-commitment discount applied to `usd`, as a whole-number percent.
   * Threshold-based per the pricing decision (Slack — Alex Tov, 2026-05-08):
   * yearly tiers are 0 / 5 / 10 / 15 / 20% with nothing in between.
   * Monthly halves these (0 / 2.5 / 5 / 7.5 / 10%) — confirmed in PRD: GA Team
   * Billing ("for monthly the discount is halved"). `CreditSlider` derives the
   * monthly value from this field via its `cycle` prop, so only the yearly
   * tiers are stored here.
   */
  discountPercentYearly: number
}

/** A selected slider stop, as emitted by the pricing table's team column. */
export interface TeamPlanSelection {
  /** Backend stop identifier (e.g. "team_700"), sent on subscribe. Present for
   *  API-sourced stops; absent only for the hardcoded OSS / pre-deploy fallback. */
  id?: string
  /** Pre-discount monthly price in USD (the struck-through list price). */
  usd: number
  /** Monthly credit grant at this stop. */
  credits: number
  /** Cycle-adjusted discounted monthly price in USD — what the user actually pays. */
  discountedUsd: number
}

/**
 * Team-plan credit-subscription slider stops — OSS / pre-deploy fallback.
 *
 * The live set comes from `GET /api/billing/plans → team_credit_stops` (mapped
 * via `mapApiTeamCreditStops`); these hardcoded DES-197 breakpoints render only
 * when the API doesn't supply them. The slider snaps to exactly these 5 fixed
 * breakpoints — the user cannot select a value in between. The `credits` figures
 * equal `usdToCredits(usd)` at the current rate (`CREDITS_PER_USD = 211`); a unit
 * test guards against rate drift silently changing the designed values.
 */
export const TEAM_PLAN_CREDIT_STOPS: readonly CreditStop[] = [
  { usd: 200, credits: 42_200, discountPercentYearly: 0 },
  { usd: 400, credits: 84_400, discountPercentYearly: 5 },
  { usd: 700, credits: 147_700, discountPercentYearly: 10 },
  { usd: 1_400, credits: 295_400, discountPercentYearly: 15 },
  { usd: 2_500, credits: 527_500, discountPercentYearly: 20 }
] as const

/** Default stop per DES-197: index 2 = $700 / 147,700 credits. */
export const DEFAULT_TEAM_PLAN_STOP_INDEX = 2

/**
 * Per-credit Team plan slug for a billing cadence (cloud catalog). The slug
 * encodes the cadence; `POST /api/billing/subscribe` reads `plan_slug` +
 * `team_credit_stop_id` and resolves all amounts server-side from the stop.
 */
export function getTeamPlanSlug(billingCycle: 'monthly' | 'yearly'): string {
  return billingCycle === 'yearly'
    ? 'team_per_credit_annual'
    : 'team_per_credit_monthly'
}
