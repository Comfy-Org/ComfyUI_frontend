import type { BillingResult } from '@comfyorg/account-core/billing'

import { WorkspaceApiError } from '@/platform/workspace/api/workspaceApi'

/**
 * A read on the SDK rail, in the shape the legacy path throws in: the HTTP
 * status rides along when the failure came from a response, so a caller that
 * treats a 401 or 403 as a denial reads it the same on either rail.
 * `SUPERSEDED` is not a failure: the scope moved on under the read, so there
 * is nothing to publish and nothing to report, the same outcome as a stale
 * legacy read.
 */
export async function readOnRail<T>(
  read: () => Promise<BillingResult<T>>
): Promise<T | undefined> {
  const result = await read()
  if (result.status === 'ok') return result.value
  if (result.code === 'SUPERSEDED') return undefined
  throw new WorkspaceApiError(result.code, result.httpStatus, result.code)
}
