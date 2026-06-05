export interface CreditStop {
  /** Monthly subscription price in USD (pre-discount). */
  usd: number
  /** Monthly credit grant at this stop. */
  credits: number
  /**
   * Yearly-commitment discount applied to `usd`, as a whole-number percent.
   * Threshold-based per the pricing decision (Slack — Alex Tov, 2026-05-08):
   * yearly tiers are 0 / 5 / 10 / 15 / 20% with nothing in between (monthly is
   * halved, but still being iterated). Only the $700 → 10% tier is
   * design-confirmed (DES-197 shows "Save 10% ($70)"); the rest follow the
   * agreed 0/5/10/15/20 sequence and should be re-confirmed with design/BE.
   */
  discountPercentYearly: number
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
 * TODO(FE-934): once the backend slider contract lands, these stops (and their
 * discount tiers) will come from `GET /api/billing/plans` instead of being
 * hardcoded here.
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
