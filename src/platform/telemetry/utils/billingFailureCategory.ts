import type { BillingTelemetryFailure } from '@comfyorg/account-core/billing'

import { WorkspaceApiError } from '@/platform/workspace/api/workspaceApi'
import { AuthStoreError } from '@/stores/authStore'

export class BillingFailureError extends Error {
  constructor(
    message: string,
    public readonly failure: BillingTelemetryFailure
  ) {
    super(message)
    this.name = 'BillingFailureError'
  }
}

export class PaymentPopupBlockedError extends BillingFailureError {
  constructor(message: string) {
    super(message, {
      failure_category: 'redirect',
      error_code: 'payment_popup_blocked'
    })
    this.name = 'PaymentPopupBlockedError'
  }
}

export function describeBillingFailure(err: unknown): BillingTelemetryFailure {
  return err instanceof BillingFailureError
    ? err.failure
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
): BillingTelemetryFailure['failure_category'] {
  if (err instanceof BillingFailureError) return err.failure.failure_category
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
