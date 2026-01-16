import type { AxiosResponse } from 'axios'
import axios from 'axios'

import { getComfyApiBaseUrl } from '@/config/comfyApi'
import { t } from '@/i18n'
import { useFirebaseAuthStore } from '@/stores/firebaseAuthStore'
import type { AuthHeader } from '@/types/authTypes'

// Types aligned with backend API (matching useWorkspaceAuth types)
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

export interface WorkspaceMember {
  id: string
  name: string
  email: string
  role: WorkspaceRole
  joined_at: string
}

export interface PendingInvite {
  id: string
  email: string
  invited_at: string
  expires_at: string
  invite_link: string
}

export interface WorkspaceDetails extends WorkspaceWithRole {
  members: WorkspaceMember[]
  pending_invites: PendingInvite[]
  subscription_status: {
    is_active: boolean
    plan: string | null
  }
}

export interface CreateWorkspacePayload {
  name: string
}

export interface UpdateWorkspacePayload {
  name: string
}

export interface CreateInvitePayload {
  email: string
}

export interface CreateInviteResponse {
  id: string
  invite_link: string
  expires_at: string
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
  baseURL: getComfyApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json'
  }
})

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

export const workspaceApi = {
  /**
   * List all workspaces the user has access to
   * GET /api/workspaces
   */
  list: (): Promise<ListWorkspacesResponse> =>
    withAuth((headers) => workspaceApiClient.get('/workspaces', { headers })),

  /**
   * Get workspace details including members and invites
   * GET /api/workspaces/:id
   */
  get: (workspaceId: string): Promise<WorkspaceDetails> =>
    withAuth((headers) =>
      workspaceApiClient.get(`/workspaces/${workspaceId}`, { headers })
    ),

  /**
   * Create a new workspace
   * POST /api/workspaces
   */
  create: (payload: CreateWorkspacePayload): Promise<WorkspaceWithRole> =>
    withAuth((headers) =>
      workspaceApiClient.post('/workspaces', payload, { headers })
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
      workspaceApiClient.patch(`/workspaces/${workspaceId}`, payload, {
        headers
      })
    ),

  /**
   * Delete a workspace (owner only)
   * DELETE /api/workspaces/:id
   */
  delete: (workspaceId: string): Promise<void> =>
    withAuth((headers) =>
      workspaceApiClient.delete(`/workspaces/${workspaceId}`, { headers })
    ),

  /**
   * Leave a workspace (member only)
   * POST /api/workspaces/:id/leave
   */
  leave: (workspaceId: string): Promise<void> =>
    withAuth((headers) =>
      workspaceApiClient.post(`/workspaces/${workspaceId}/leave`, null, {
        headers
      })
    ),

  /**
   * Create an invite link for a workspace
   * POST /api/workspaces/:id/invites
   */
  createInvite: (
    workspaceId: string,
    payload: CreateInvitePayload
  ): Promise<CreateInviteResponse> =>
    withAuth((headers) =>
      workspaceApiClient.post(`/workspaces/${workspaceId}/invites`, payload, {
        headers
      })
    ),

  /**
   * Revoke a pending invite
   * DELETE /api/workspaces/:id/invites/:inviteId
   */
  revokeInvite: (workspaceId: string, inviteId: string): Promise<void> =>
    withAuth((headers) =>
      workspaceApiClient.delete(
        `/workspaces/${workspaceId}/invites/${inviteId}`,
        { headers }
      )
    ),

  /**
   * Remove a member from workspace
   * DELETE /api/workspaces/:id/members/:memberId
   */
  removeMember: (workspaceId: string, memberId: string): Promise<void> =>
    withAuth((headers) =>
      workspaceApiClient.delete(
        `/workspaces/${workspaceId}/members/${memberId}`,
        { headers }
      )
    )
}
