import { WorkspaceApiError } from '@/platform/workspace/api/workspaceApi'
import { AuthStoreError } from '@/stores/authStore'

import type { BillingFailure } from '../types'

/**
 * Maps a caught billing-request error to a `BillingFailureCategory` based on
 * where in the request lifecycle it originated, rather than defaulting
 * everything to `unknown`:
 * - `WorkspaceApiError`/`AuthStoreError` mean the request reached the backend,
 *   which rejected it (`api_rejected`) — `WorkspaceApiError` additionally
 *   carries a `status`, so an undefined one (no HTTP response at all) means
 *   the request never reached the backend (`network`).
 * - A bare `TypeError` is what `fetch` throws for a connectivity failure
 *   (`network`).
 * - Anything else (e.g. a malformed-response `Error` thrown locally) is
 *   genuinely unclassifiable from a caught error alone.
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
  if (err instanceof TypeError) {
    return 'network'
  }
  return 'unknown'
}
