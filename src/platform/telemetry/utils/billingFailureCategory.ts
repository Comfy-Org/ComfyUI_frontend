import { WorkspaceApiError } from '@/platform/workspace/api/workspaceApi'
import { AuthStoreError } from '@/stores/authStore'

import type { BillingFailure } from '../types'

/**
 * A `WorkspaceApiError` with no `status` never reached the backend (`network`);
 * a `TypeError` naming fetch/network/load is what `fetch` throws for connectivity failures.
 */
export function categorizeBillingApiError(
  err: unknown
): BillingFailure['failure_category'] {
  if (err instanceof WorkspaceApiError) {
    return err.status === undefined ? 'network' : 'api_rejected'
  }
  if (err instanceof AuthStoreError) {
    return 'api_rejected'
  }
  if (
    err instanceof TypeError &&
    /fetch|network|load failed/i.test(err.message)
  ) {
    return 'network'
  }
  return 'unknown'
}
