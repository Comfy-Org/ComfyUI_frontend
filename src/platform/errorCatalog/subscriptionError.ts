import { SUBSCRIPTION_REQUIRED_CATALOG_ID } from './catalogIds'

export function isSubscriptionRequiredCatalogId(
  catalogId: string | undefined
): boolean {
  return catalogId === SUBSCRIPTION_REQUIRED_CATALOG_ID
}
