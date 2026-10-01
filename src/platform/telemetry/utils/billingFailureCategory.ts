import { WorkspaceApiError } from '@/platform/workspace/api/workspaceApi'
import { AuthStoreError } from '@/stores/authStore'

import type { BillingFailure } from '../types'

export class PaymentPopupBlockedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PaymentPopupBlockedError'
  }
}

export function describeBillingFailure(err: unknown): BillingFailure {
  return err instanceof PaymentPopupBlockedError
    ? { failure_category: 'redirect', error_code: 'payment_popup_blocked' }
    : { failure_category: categorizeBillingApiError(err) }
}

/**
 * A `WorkspaceApiError` that names its category keeps it. Otherwise a
 * `WorkspaceApiError`/`AuthStoreError` with no `status` never reached the
 * backend (`network`); a `TypeError` naming fetch/network/load is what `fetch`
 * throws for connectivity failures.
 */
export function categorizeBillingApiError(
  err: unknown
): BillingFailure['failure_category'] {
  if (err instanceof PaymentPopupBlockedError) return 'redirect'
  if (err instanceof WorkspaceApiError) {
    if (err.failureCategory) return err.failureCategory
    return err.status === undefined ? 'network' : 'api_rejected'
  }
  if (err instanceof AuthStoreError) {
    return err.status === undefined ? 'network' : 'api_rejected'
  }
  if (
    err instanceof TypeError &&
    /fetch|network|load failed/i.test(err.message)
  ) {
    return 'network'
  }
  return 'unknown'
}
