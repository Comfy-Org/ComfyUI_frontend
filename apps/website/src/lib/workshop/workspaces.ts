import type { z } from 'zod'

import { zListWorkspacesResponse } from '@comfyorg/ingest-types/zod'

import { WORKSHOP_CLOUD_BASE_URL } from '../../config/workshop-env'

export type WorkspaceWithRole = z.infer<
  typeof zListWorkspacesResponse
>['workspaces'][number]

/**
 * The workspaces the signed-in account belongs to, from the session's own
 * Cloud. Switching itself is the session client's remint with a target
 * workspace id; this list is what makes the targets visible.
 */
export async function listWorkspaces(
  token: string
): Promise<readonly WorkspaceWithRole[]> {
  const response = await fetch(
    new URL('/api/workspaces', WORKSHOP_CLOUD_BASE_URL),
    { headers: { Authorization: 'Bearer ' + token } }
  )
  if (!response.ok)
    throw new Error('Workspace list failed with status ' + response.status)
  const body: unknown = await response.json().catch(() => undefined)
  const parsed = zListWorkspacesResponse.safeParse(body)
  if (!parsed.success) throw new Error('Workspace list response malformed')
  return parsed.data.workspaces
}
