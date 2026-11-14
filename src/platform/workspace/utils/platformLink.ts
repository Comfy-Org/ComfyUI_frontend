import {
  isWorkspaceId,
  withWorkspaceLink
} from '@comfyorg/account-core/workspaceLink'
import {
  ENTRY_PARAM_RETURN_TO,
  ENTRY_PARAM_SOURCE,
  isBillingSource
} from '@comfyorg/billing-contract'
import type { ReturnTarget } from '@comfyorg/billing-contract'

import { getComfyPlatformBaseUrl } from '@/config/comfyApi'
import { isCloud } from '@/platform/distribution/types'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

function returnTarget(): ReturnTarget {
  return isCloud ? 'comfyui_workspace' : 'comfyui_local'
}

/** A platform URL for `path` that names the app to return to, opens in the cloud app's active workspace when there is one, and carries `correlationId` and the paywall `source` when given. */
export function platformLink(
  path: `/${string}`,
  correlationId?: string,
  source?: string
): string {
  const url = new URL(`${getComfyPlatformBaseUrl()}${path}`)
  if (correlationId) url.searchParams.set('correlation_id', correlationId)
  url.searchParams.set(ENTRY_PARAM_RETURN_TO, returnTarget())
  if (isBillingSource(source)) url.searchParams.set(ENTRY_PARAM_SOURCE, source)
  const workspaceId = useTeamWorkspaceStore().activeWorkspaceId
  if (!workspaceId || !isWorkspaceId(workspaceId)) return url.href
  return withWorkspaceLink(url, workspaceId).href
}
