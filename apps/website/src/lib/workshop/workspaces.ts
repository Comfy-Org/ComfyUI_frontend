import { zListWorkspacesResponse } from '@comfyorg/ingest-types/zod'
import type { z } from 'zod'

import { WORKSHOP_CLOUD_BASE_URL } from '../../config/workshop-env'

export type WorkspaceWithRole = z.infer<
  typeof zListWorkspacesResponse
>['workspaces'][number]

export interface ListWorkspacesOptions {
  readonly signal?: AbortSignal
  readonly timeoutMs?: number
}

/**
 * The workspaces the signed-in account belongs to, from the session's own
 * Cloud. Switching itself is the session client's remint with a target
 * workspace id; this list is what makes the targets visible.
 */
export async function listWorkspaces(
  token: string,
  options: ListWorkspacesOptions = {}
): Promise<readonly WorkspaceWithRole[]> {
  const timeout = AbortSignal.timeout(options.timeoutMs ?? 15_000)
  const signal = options.signal
    ? AbortSignal.any([options.signal, timeout])
    : timeout
  const response = await fetch(
    new URL('/api/workspaces', WORKSHOP_CLOUD_BASE_URL),
    { headers: { Authorization: 'Bearer ' + token }, signal }
  )
  if (!response.ok)
    throw new Error('Workspace list failed with status ' + response.status)
  const body: unknown = await response.json().catch(() => undefined)
  const parsed = zListWorkspacesResponse.safeParse(body)
  if (!parsed.success) throw new Error('Workspace list response malformed')
  return parsed.data.workspaces
}
