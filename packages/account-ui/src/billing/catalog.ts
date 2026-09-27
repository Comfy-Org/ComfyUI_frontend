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
