import type { AxiosResponse } from 'axios'
import axios from 'axios'

import { t } from '@/i18n'
import { api } from '@/scripts/api'
import { useFirebaseAuthStore } from '@/stores/firebaseAuthStore'
import type { AuthHeader } from '@/types/authTypes'

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

// Billing types (POST /api/billing/portal)
export interface BillingPortalRequest {
  return_url: string
}

export interface BillingPortalResponse {
  billing_portal_url: string
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

// Token exchange types (POST /api/auth/token)
export interface ExchangeTokenRequest {
  workspace_id: string
}

export interface ExchangeTokenResponse {
  token: string
  expires_at: string
  workspace: Workspace
  role: WorkspaceRole
  permissions: string[]
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
 * Wrapper for workspace-scoped endpoints (e.g., /api/workspace/members).
 * The workspace context is determined from the Bearer token.
 */
const withWorkspaceAuth = withAuth

/**
 * Wrapper that uses Firebase ID token directly (not workspace token).
 * Used for token exchange where we need the Firebase token to get a workspace token.
 */
async function withFirebaseAuth<T>(
  request: (headers: AuthHeader) => Promise<AxiosResponse<T>>
): Promise<T> {
  const firebaseToken = await useFirebaseAuthStore().getIdToken()
  if (!firebaseToken) {
    throw new WorkspaceApiError(
      t('toastMessages.userNotAuthenticated'),
      401,
      'NOT_AUTHENTICATED'
    )
  }
  const headers: AuthHeader = { Authorization: `Bearer ${firebaseToken}` }
  try {
    const response = await request(headers)
    return response.data
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const status = err.response?.status
      const message = err.response?.data?.message ?? err.message
      const code =
        status === 401
          ? 'INVALID_FIREBASE_TOKEN'
          : status === 403
            ? 'ACCESS_DENIED'
            : status === 404
              ? 'WORKSPACE_NOT_FOUND'
              : 'TOKEN_EXCHANGE_FAILED'
      throw new WorkspaceApiError(message, status, code)
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
    ),

  /**
   * Exchange Firebase JWT for workspace-scoped Cloud JWT.
   * POST /api/auth/token
   *
   * Uses Firebase ID token directly (not getAuthHeader) since we're
   * exchanging it for a workspace-scoped token.
   */
  exchangeToken: (workspaceId: string): Promise<ExchangeTokenResponse> =>
    withFirebaseAuth((headers) =>
      workspaceApiClient.post(
        api.apiURL('/auth/token'),
        { workspace_id: workspaceId } satisfies ExchangeTokenRequest,
        { headers }
      )
    ),

  /**
   * Access the billing portal for the current workspace.
   * POST /api/billing/portal
   *
   * Uses workspace-scoped token to get billing portal URL.
   */
  accessBillingPortal: (returnUrl?: string): Promise<BillingPortalResponse> =>
    withWorkspaceAuth((headers) =>
      workspaceApiClient.post(
        api.apiURL('/billing/portal'),
        { return_url: returnUrl ?? window.location.href } satisfies BillingPortalRequest,
        { headers }
      )
    )
}
