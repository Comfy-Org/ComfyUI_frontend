import type { BillingResult } from '@comfyorg/account-core/billing'

import { WorkspaceApiError } from '@/platform/workspace/api/workspaceApi'

/**
 * A read on the SDK rail, in the shape the legacy path throws in. `SUPERSEDED`
 * is not a failure: the scope moved on under the read, so there is nothing to
 * publish and nothing to report, the same outcome as a stale legacy read.
 */
export async function readOnRail<T>(
  read: () => Promise<BillingResult<T>>
): Promise<T | undefined> {
  const result = await read()
  if (result.status === 'ok') return result.value
  if (result.code === 'SUPERSEDED') return undefined
  throw new WorkspaceApiError(result.code, undefined, result.code)
}
