import {
  isWorkspaceId,
  withWorkspaceLink
} from '@comfyorg/account-core/workspaceLink'

import { getComfyPlatformBaseUrl } from '@/config/comfyApi'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

/** A platform URL for `path` that opens in the cloud app's active workspace, when there is one, and carries `correlationId` when given. */
export function platformLink(
  path: `/${string}`,
  correlationId?: string
): string {
  const url = new URL(`${getComfyPlatformBaseUrl()}${path}`)
  if (correlationId) url.searchParams.set('correlation_id', correlationId)
  const workspaceId = useTeamWorkspaceStore().activeWorkspaceId
  if (!workspaceId || !isWorkspaceId(workspaceId)) return url.href
  return withWorkspaceLink(url, workspaceId).href
}
