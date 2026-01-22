import axios from 'axios'

import { t } from '@/i18n'
import { api } from '@/scripts/api'
import { useFirebaseAuthStore } from '@/stores/firebaseAuthStore'

export type WorkspaceType = 'personal' | 'team'
export type WorkspaceRole = 'owner' | 'member'

interface Workspace {
  id: string
  name: string
  type: WorkspaceType
}

export interface WorkspaceWithRole extends Workspace {
  role: WorkspaceRole
}

export interface Member {
  id: string
  name: string
  email: string
  joined_at: string
}

interface PaginationInfo {
  offset: number
  limit: number
  total: number
}

interface ListMembersResponse {
  members: Member[]
  pagination: PaginationInfo
}

export interface ListMembersParams {
  offset?: number
  limit?: number
}

export interface PendingInvite {
  id: string
  email: string
  token: string
  invited_at: string
  expires_at: string
}

interface ListInvitesResponse {
  invites: PendingInvite[]
}

interface CreateInviteRequest {
  email: string
}

interface AcceptInviteResponse {
  workspace_id: string
  workspace_name: string
}

interface BillingPortalRequest {
  return_url: string
}

interface BillingPortalResponse {
  billing_portal_url: string
}

interface CreateWorkspacePayload {
  name: string
}

interface UpdateWorkspacePayload {
  name: string
}

interface ListWorkspacesResponse {
  workspaces: WorkspaceWithRole[]
}

class WorkspaceApiError extends Error {
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

async function getAuthHeaderOrThrow() {
  const authHeader = await useFirebaseAuthStore().getAuthHeader()
  if (!authHeader) {
    throw new WorkspaceApiError(
      t('toastMessages.userNotAuthenticated'),
      401,
      'NOT_AUTHENTICATED'
    )
  }
  return authHeader
}

function handleAxiosError(err: unknown): never {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status
    const message = err.response?.data?.message ?? err.message
    throw new WorkspaceApiError(message, status)
  }
  throw err
}

export const workspaceApi = {
  /**
   * List all workspaces the user has access to
   * GET /api/workspaces
   */
  async list(): Promise<ListWorkspacesResponse> {
    const headers = await getAuthHeaderOrThrow()
    try {
      const response = await workspaceApiClient.get<ListWorkspacesResponse>(
        api.apiURL('/workspaces'),
        { headers }
      )
      return response.data
    } catch (err) {
      handleAxiosError(err)
    }
  },

  /**
   * Create a new workspace
   * POST /api/workspaces
   */
  async create(payload: CreateWorkspacePayload): Promise<WorkspaceWithRole> {
    const headers = await getAuthHeaderOrThrow()
    try {
      const response = await workspaceApiClient.post<WorkspaceWithRole>(
        api.apiURL('/workspaces'),
        payload,
        { headers }
      )
      return response.data
    } catch (err) {
      handleAxiosError(err)
    }
  },

  /**
   * Update workspace name
   * PATCH /api/workspaces/:id
   */
  async update(
    workspaceId: string,
    payload: UpdateWorkspacePayload
  ): Promise<WorkspaceWithRole> {
    const headers = await getAuthHeaderOrThrow()
    try {
      const response = await workspaceApiClient.patch<WorkspaceWithRole>(
        api.apiURL(`/workspaces/${workspaceId}`),
        payload,
        { headers }
      )
      return response.data
    } catch (err) {
      handleAxiosError(err)
    }
  },

  /**
   * Delete a workspace (owner only)
   * DELETE /api/workspaces/:id
   */
  async delete(workspaceId: string): Promise<void> {
    const headers = await getAuthHeaderOrThrow()
    try {
      await workspaceApiClient.delete(
        api.apiURL(`/workspaces/${workspaceId}`),
        {
          headers
        }
      )
    } catch (err) {
      handleAxiosError(err)
    }
  },

  /**
   * Leave the current workspace.
   * POST /api/workspace/leave
   */
  async leave(): Promise<void> {
    const headers = await getAuthHeaderOrThrow()
    try {
      await workspaceApiClient.post(api.apiURL('/workspace/leave'), null, {
        headers
      })
    } catch (err) {
      handleAxiosError(err)
    }
  },

  /**
   * List workspace members (paginated).
   * GET /api/workspace/members
   */
  async listMembers(params?: ListMembersParams): Promise<ListMembersResponse> {
    const headers = await getAuthHeaderOrThrow()
    try {
      const response = await workspaceApiClient.get<ListMembersResponse>(
        api.apiURL('/workspace/members'),
        { headers, params }
      )
      return response.data
    } catch (err) {
      handleAxiosError(err)
    }
  },

  /**
   * Remove a member from the workspace.
   * DELETE /api/workspace/members/:userId
   */
  async removeMember(userId: string): Promise<void> {
    const headers = await getAuthHeaderOrThrow()
    try {
      await workspaceApiClient.delete(
        api.apiURL(`/workspace/members/${userId}`),
        { headers }
      )
    } catch (err) {
      handleAxiosError(err)
    }
  },

  /**
   * List pending invites for the workspace.
   * GET /api/workspace/invites
   */
  async listInvites(): Promise<ListInvitesResponse> {
    const headers = await getAuthHeaderOrThrow()
    try {
      const response = await workspaceApiClient.get<ListInvitesResponse>(
        api.apiURL('/workspace/invites'),
        { headers }
      )
      return response.data
    } catch (err) {
      handleAxiosError(err)
    }
  },

  /**
   * Create an invite for the workspace.
   * POST /api/workspace/invites
   */
  async createInvite(payload: CreateInviteRequest): Promise<PendingInvite> {
    const headers = await getAuthHeaderOrThrow()
    try {
      const response = await workspaceApiClient.post<PendingInvite>(
        api.apiURL('/workspace/invites'),
        payload,
        { headers }
      )
      return response.data
    } catch (err) {
      handleAxiosError(err)
    }
  },

  /**
   * Revoke a pending invite.
   * DELETE /api/workspace/invites/:inviteId
   */
  async revokeInvite(inviteId: string): Promise<void> {
    const headers = await getAuthHeaderOrThrow()
    try {
      await workspaceApiClient.delete(
        api.apiURL(`/workspace/invites/${inviteId}`),
        { headers }
      )
    } catch (err) {
      handleAxiosError(err)
    }
  },

  /**
   * Accept a workspace invite.
   * POST /api/invites/:token/accept
   */
  async acceptInvite(token: string): Promise<AcceptInviteResponse> {
    const headers = await getAuthHeaderOrThrow()
    try {
      const response = await workspaceApiClient.post<AcceptInviteResponse>(
        api.apiURL(`/invites/${token}/accept`),
        null,
        { headers }
      )
      return response.data
    } catch (err) {
      handleAxiosError(err)
    }
  },

  /**
   * Access the billing portal for the current workspace.
   * POST /api/billing/portal
   */
  async accessBillingPortal(
    returnUrl?: string
  ): Promise<BillingPortalResponse> {
    const headers = await getAuthHeaderOrThrow()
    try {
      const response = await workspaceApiClient.post<BillingPortalResponse>(
        api.apiURL('/billing/portal'),
        {
          return_url: returnUrl ?? window.location.href
        } satisfies BillingPortalRequest,
        { headers }
      )
      return response.data
    } catch (err) {
      handleAxiosError(err)
    }
  }
}
