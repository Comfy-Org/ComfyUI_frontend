import type { AxiosResponse } from 'axios'
import axios from 'axios'

import { t } from '@/i18n'
import { api } from '@/scripts/api'
import { useFirebaseAuthStore } from '@/stores/firebaseAuthStore'
import type { AuthHeader } from '@/types/authTypes'

import { sessionManager } from '../services/sessionManager'

// Types aligned with backend API
export type WorkspaceType = 'personal' | 'team'
export type WorkspaceRole = 'owner' | 'member'

export interface Workspace {
  id: string
  name: string
  type: WorkspaceType
}

export interface WorkspaceWithRole extends Workspace {
  role: WorkspaceRole
}

// Member type from API
export interface Member {
  id: string
  name: string
  email: string
  joined_at: string
}

export interface PaginationInfo {
  offset: number
  limit: number
  total: number
}

export interface ListMembersResponse {
  members: Member[]
  pagination: PaginationInfo
}

export interface ListMembersParams {
  offset?: number
  limit?: number
}

// Pending invite type from API
export interface PendingInvite {
  id: string
  email: string
  token: string
  invited_at: string
  expires_at: string
}

export interface ListInvitesResponse {
  invites: PendingInvite[]
}

export interface CreateInviteRequest {
  email: string
}

export interface AcceptInviteResponse {
  workspace_id: string
  workspace_name: string
}

export interface CreateWorkspacePayload {
  name: string
}

export interface UpdateWorkspacePayload {
  name: string
}

// API responses
export interface ListWorkspacesResponse {
  workspaces: WorkspaceWithRole[]
}

export class WorkspaceApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly code?: string
  ) {
    super(message)
    this.name = 'WorkspaceApiError'
  }
}

const workspaceApiClient = axios.create({
  headers: {
    'Content-Type': 'application/json'
  }
})

type RequestHeaders = AuthHeader & { 'X-Workspace-ID'?: string }

async function withAuth<T>(
  request: (headers: AuthHeader) => Promise<AxiosResponse<T>>
): Promise<T> {
  const authHeader = await useFirebaseAuthStore().getAuthHeader()
  if (!authHeader) {
    throw new WorkspaceApiError(
      t('toastMessages.userNotAuthenticated'),
      401,
      'NOT_AUTHENTICATED'
    )
  }
  try {
    const response = await request(authHeader)
    return response.data
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const status = err.response?.status
      const message = err.response?.data?.message ?? err.message
      throw new WorkspaceApiError(message, status)
    }
    throw err
  }
}

/**
 * Wrapper that adds both auth header and workspace ID header.
 * Use for workspace-scoped endpoints (e.g., /api/workspace/members).
 */
async function withWorkspaceAuth<T>(
  request: (headers: RequestHeaders) => Promise<AxiosResponse<T>>
): Promise<T> {
  const authHeader = await useFirebaseAuthStore().getAuthHeader()
  if (!authHeader) {
    throw new WorkspaceApiError(
      t('toastMessages.userNotAuthenticated'),
      401,
      'NOT_AUTHENTICATED'
    )
  }

  const workspaceId = sessionManager.getCurrentWorkspaceId()
  if (!workspaceId) {
    throw new WorkspaceApiError(
      'No active workspace',
      400,
      'NO_ACTIVE_WORKSPACE'
    )
  }

  const headers: RequestHeaders = {
    ...authHeader,
    'X-Workspace-ID': workspaceId
  }

  try {
    const response = await request(headers)
    return response.data
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const status = err.response?.status
      const message = err.response?.data?.message ?? err.message
      throw new WorkspaceApiError(message, status)
    }
    throw err
  }
}

export const workspaceApi = {
  /**
   * List all workspaces the user has access to
   * GET /api/workspaces
   */
  list: (): Promise<ListWorkspacesResponse> =>
    withAuth((headers) =>
      workspaceApiClient.get(api.apiURL('/workspaces'), { headers })
    ),

  /**
   * Create a new workspace
   * POST /api/workspaces
   */
  create: (payload: CreateWorkspacePayload): Promise<WorkspaceWithRole> =>
    withAuth((headers) =>
      workspaceApiClient.post(api.apiURL('/workspaces'), payload, { headers })
    ),

  /**
   * Update workspace name
   * PATCH /api/workspaces/:id
   */
  update: (
    workspaceId: string,
    payload: UpdateWorkspacePayload
  ): Promise<WorkspaceWithRole> =>
    withAuth((headers) =>
      workspaceApiClient.patch(
        api.apiURL(`/workspaces/${workspaceId}`),
        payload,
        { headers }
      )
    ),

  /**
   * Delete a workspace (owner only)
   * DELETE /api/workspaces/:id
   */
  delete: (workspaceId: string): Promise<void> =>
    withAuth((headers) =>
      workspaceApiClient.delete(api.apiURL(`/workspaces/${workspaceId}`), {
        headers
      })
    ),

  /**
   * Leave the current workspace.
   * POST /api/workspace/leave
   */
  leave: (): Promise<void> =>
    withWorkspaceAuth((headers) =>
      workspaceApiClient.post(api.apiURL('/workspace/leave'), null, { headers })
    ),

  /**
   * List workspace members (paginated).
   * GET /api/workspace/members
   */
  listMembers: (params?: ListMembersParams): Promise<ListMembersResponse> =>
    withWorkspaceAuth((headers) =>
      workspaceApiClient.get(api.apiURL('/workspace/members'), {
        headers,
        params
      })
    ),

  /**
   * Remove a member from the workspace.
   * DELETE /api/workspace/members/:userId
   */
  removeMember: (userId: string): Promise<void> =>
    withWorkspaceAuth((headers) =>
      workspaceApiClient.delete(api.apiURL(`/workspace/members/${userId}`), {
        headers
      })
    ),

  /**
   * List pending invites for the workspace.
   * GET /api/workspace/invites
   */
  listInvites: (): Promise<ListInvitesResponse> =>
    withWorkspaceAuth((headers) =>
      workspaceApiClient.get(api.apiURL('/workspace/invites'), { headers })
    ),

  /**
   * Create an invite for the workspace.
   * POST /api/workspace/invites
   */
  createInvite: (payload: CreateInviteRequest): Promise<PendingInvite> =>
    withWorkspaceAuth((headers) =>
      workspaceApiClient.post(api.apiURL('/workspace/invites'), payload, {
        headers
      })
    ),

  /**
   * Revoke a pending invite.
   * DELETE /api/workspace/invites/:inviteId
   */
  revokeInvite: (inviteId: string): Promise<void> =>
    withWorkspaceAuth((headers) =>
      workspaceApiClient.delete(api.apiURL(`/workspace/invites/${inviteId}`), {
        headers
      })
    ),

  /**
   * Accept a workspace invite.
   * POST /api/invites/:token/accept
   */
  acceptInvite: (token: string): Promise<AcceptInviteResponse> =>
    withAuth((headers) =>
      workspaceApiClient.post(api.apiURL(`/invites/${token}/accept`), null, {
        headers
      })
    )
}
