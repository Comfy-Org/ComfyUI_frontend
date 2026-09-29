/**
 * The workspace's pending invites, over the same session transport the
 * billing commands use, so a host that checks out a team plan can invite the
 * team without a second client. The workspace is the one the transport's
 * token was minted for.
 */
import {
  zCreateWorkspaceInviteResponse,
  zListInvitesResponse
} from '@comfyorg/ingest-types/zod'
import type {
  zCreateInviteRequest,
  zPendingInvite
} from '@comfyorg/ingest-types/zod'
import type { z } from 'zod'

import type { BillingResult, BillingTransport } from './billingContracts.js'
import { readValidatedBillingResponse } from './sharedRead.js'

export const WORKSPACE_INVITES_ROUTE = '/workspace/invites'

export type WorkspaceInvite = z.infer<typeof zPendingInvite>

export interface WorkspaceInviteCommands {
  readonly listPendingInvites: () => Promise<
    BillingResult<readonly WorkspaceInvite[]>
  >
  readonly createInvite: (
    email: string
  ) => Promise<BillingResult<WorkspaceInvite>>
}

export function createWorkspaceInviteCommands(options: {
  readonly transport: BillingTransport
}): WorkspaceInviteCommands {
  const { transport } = options

  async function listPendingInvites(): Promise<
    BillingResult<readonly WorkspaceInvite[]>
  > {
    const response = await readValidatedBillingResponse(
      transport,
      { method: 'GET', route: WORKSPACE_INVITES_ROUTE },
      (body) => zListInvitesResponse.safeParse(body)
    )
    return response.status === 'error'
      ? response
      : { status: 'ok', value: response.value.data.invites }
  }

  async function createInvite(
    email: string
  ): Promise<BillingResult<WorkspaceInvite>> {
    const body: z.infer<typeof zCreateInviteRequest> = { email }
    const response = await readValidatedBillingResponse(
      transport,
      { method: 'POST', route: WORKSPACE_INVITES_ROUTE, body },
      (raw) => zCreateWorkspaceInviteResponse.safeParse(raw)
    )
    return response.status === 'error'
      ? response
      : { status: 'ok', value: response.value.data }
  }

  return { listPendingInvites, createInvite }
}
