import { SUBSCRIPTION_REQUIRED_CATALOG_ID } from '@/platform/errorCatalog/catalogIds'

import type { ErrorItem } from './types'

export function hasSubscriptionError(errors: ErrorItem[]): boolean {
  return errors.some(
    (error) => error.catalogId === SUBSCRIPTION_REQUIRED_CATALOG_ID
  )
}
