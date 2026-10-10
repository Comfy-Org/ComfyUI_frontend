/**
 * The self-serve tiers' list prices (USD per month, billed monthly or
 * yearly) and monthly credit grants. The cloud app's pricing table and both
 * checkout hosts read this one table, so a plan cannot price or grant
 * differently between the app and billing-web.
 */
export const TIER_CATALOG = {
  standard: { monthly: 20, yearly: 16, credits: 4200 },
  creator: { monthly: 35, yearly: 28, credits: 7400 },
  pro: { monthly: 100, yearly: 80, credits: 21100 }
} as const satisfies Record<
  string,
  { monthly: number; yearly: number; credits: number }
>

export type CatalogTierKey = keyof typeof TIER_CATALOG

/** The catalog key for a server tier (`'CREATOR'`), if it is a self-serve one. */
export function toCatalogTierKey(tier: string): CatalogTierKey | undefined {
  const key = tier.toLowerCase()
  return Object.hasOwn(TIER_CATALOG, key) ? (key as CatalogTierKey) : undefined
}

/** A team credit stop's list price and grant, as the pricing table shows it. */
export interface TeamCreditStopPrice {
  readonly id: string
  /** Monthly list price in USD, before the yearly-commitment discount. */
  readonly usd: number
  readonly credits: number
  /** The yearly discount as a whole percent; monthly billing halves it. */
  readonly discountPercentYearly: number
}

/**
 * Reads the server's `team_credit_stops`: the yearly list price is the
 * monthly list price, and the discount is the struck vs charged yearly price.
 */
export function mapApiTeamCreditStops(
  stops: readonly {
    id: string
    credits: number
    yearly: { list_price_cents: number; price_cents: number }
  }[]
): TeamCreditStopPrice[] {
  return stops.map((stop) => {
    const listCents = stop.yearly.list_price_cents
    const discountPercentYearly =
      listCents > 0
        ? Math.round(((listCents - stop.yearly.price_cents) / listCents) * 100)
        : 0
    return {
      id: stop.id,
      usd: Math.round(listCents / 100),
      credits: stop.credits,
      discountPercentYearly
    }
  })
}

/**
 * The discounted monthly price of a credit stop for a billing cycle. The
 * pricing table and both checkout hosts price a team stop through this, so
 * the slider and the confirm never drift.
 */
export function getStopDiscountedMonthlyUsd(
  stop: Pick<TeamCreditStopPrice, 'usd' | 'discountPercentYearly'>,
  cycle: 'monthly' | 'yearly'
): number {
  const percent =
    cycle === 'monthly'
      ? stop.discountPercentYearly / 2
      : stop.discountPercentYearly
  return Math.round(stop.usd * (1 - percent / 100))
}
