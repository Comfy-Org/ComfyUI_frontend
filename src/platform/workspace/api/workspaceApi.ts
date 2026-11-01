import type { AxiosRequestConfig } from 'axios'

import type {
  AcceptInviteResponse,
  CreateInviteRequest,
  CreateWorkspaceRequest,
  CurrentWorkspaceResponse,
  DeploymentCompatibility,
  DeploymentCompatibilityRequest,
  ListInvitesResponse,
  ListMembersResponse,
  ListWorkspacesResponse,
  Member as GeneratedMember,
  PendingInvite,
  PickWorkspaceDeploymentRequest,
  ReleaseUnsupportedPacks,
  StartWorkspaceDeploymentResult,
  UpdateWorkspaceRequest,
  WorkspaceDeployment,
  WorkspaceDeploymentCpuServer,
  WorkspaceDeploymentList,
  WorkspaceWithRole
} from '@comfyorg/ingest-types'
import {
  zDeploymentCompatibility,
  zReleaseUnsupportedPacks,
  zStartWorkspaceDeploymentResult,
  zWorkspaceDeploymentCpuServer
} from '@comfyorg/ingest-types/zod'
import {
  DEPLOYMENT_LISTING_TIMEOUT_MS,
  DEPLOYMENT_START_TIMEOUT_MS
} from './deploymentListingTimeouts'
import type {
  WorkspaceId,
  WorkspaceInviteId
} from '@/platform/workspace/workspaceTypes'
import type { UserId } from '@comfyorg/api-client/authTypes'
import {
  ingestApiClient as workspaceApiClient,
  requestAuth,
  requireIngestApiAuth as requireWorkspaceApiAuth,
  handleAxiosError
} from '@/platform/remote/ingest/ingestApi'
import { ingestApiUrl as ingestApiUrl } from '@/platform/remote/ingest/ingestApiUrl'
export type WorkspaceType = 'personal' | 'team'
export type WorkspaceRole = 'owner' | 'member'

export type Member = GeneratedMember & {
  credits_used_this_month?: number
  monthly_credit_limit?: number | null
}

export interface ListMembersParams {
  offset?: number
  limit?: number
}

export type { PendingInvite }

export type { WorkspaceWithRole }
export type { ListWorkspacesResponse }
export type { CurrentWorkspaceResponse }

export type { WorkspaceDeployment }
export type { WorkspaceDeploymentList }

export type { DeploymentCompatibility }

export type { WorkspaceDeploymentCpuServer }

const CPU_SERVER_READ_TIMEOUT_MS = 15_000

/** For callers that already retry on their own schedule. */
interface ReadOptions {
  skipStatusRetry?: boolean
}

function withReadOptions(
  auth: AxiosRequestConfig,
  { skipStatusRetry }: ReadOptions
): AxiosRequestConfig {
  return skipStatusRetry ? { ...auth, __skipStatusRetry: true } : auth
}

export const workspaceApi = {
  async list(options: ReadOptions = {}): Promise<ListWorkspacesResponse> {
    const auth = await requestAuth()
    try {
      const response = await workspaceApiClient.get<ListWorkspacesResponse>(
        ingestApiUrl('/workspaces'),
        withReadOptions(auth, options)
      )
      return response.data
    } catch (err) {
      handleAxiosError(err, 'list')
    }
  },
  async getCurrentWorkspace(
    options: ReadOptions = {}
  ): Promise<CurrentWorkspaceResponse> {
    const auth = await requestAuth()
    try {
      const response = await workspaceApiClient.get<CurrentWorkspaceResponse>(
        ingestApiUrl('/workspaces/current'),
        withReadOptions(auth, options)
      )
      return response.data
    } catch (err) {
      handleAxiosError(err, 'getCurrentWorkspace')
    }
  },
  async create(payload: CreateWorkspaceRequest): Promise<WorkspaceWithRole> {
    const auth = await requestAuth()
    try {
      const response = await workspaceApiClient.post<WorkspaceWithRole>(
        ingestApiUrl('/workspaces'),
        payload,
        auth
      )
      return response.data
    } catch (err) {
      handleAxiosError(err, 'create')
    }
  },
  async update(
    workspaceId: WorkspaceId,
    payload: UpdateWorkspaceRequest
  ): Promise<WorkspaceWithRole> {
    const auth = await requestAuth()
    try {
      const response = await workspaceApiClient.patch<WorkspaceWithRole>(
        ingestApiUrl(`/workspaces/${workspaceId}`),
        payload,
        auth
      )
      return response.data
    } catch (err) {
      handleAxiosError(err, 'update')
    }
  },
  async listDeployments(
    workspaceId: WorkspaceId,
    startedDeploymentIds: readonly string[]
  ): Promise<WorkspaceDeploymentList> {
    const auth = await requestAuth()
    try {
      const response = await workspaceApiClient.get<WorkspaceDeploymentList>(
        ingestApiUrl(`/workspaces/${workspaceId}/deployments`),
        {
          ...auth,
          params: { started_deployment_id: startedDeploymentIds },
          paramsSerializer: { indexes: null },
          timeout: DEPLOYMENT_LISTING_TIMEOUT_MS,
          __skipStatusRetry: true
        }
      )
      return response.data
    } catch (err) {
      handleAxiosError(err, 'listDeployments')
    }
  },
  async pickDeployment(
    workspaceId: WorkspaceId,
    payload: PickWorkspaceDeploymentRequest,
    signal?: AbortSignal
  ): Promise<void> {
    const auth = await requestAuth()
    signal?.throwIfAborted()
    try {
      await workspaceApiClient.put(
        ingestApiUrl(`/workspaces/${workspaceId}/deployment`),
        payload,
        { ...auth, ...(signal ? { signal } : {}) }
      )
    } catch (err) {
      handleAxiosError(err, 'pickDeployment')
    }
  },
  async startDeployment(
    workspaceId: WorkspaceId,
    deploymentId: string
  ): Promise<StartWorkspaceDeploymentResult> {
    const auth = await requestAuth()
    try {
      const response = await workspaceApiClient.post<unknown>(
        ingestApiUrl(
          `/workspaces/${workspaceId}/deployments/${encodeURIComponent(deploymentId)}/start`
        ),
        undefined,
        { ...auth, timeout: DEPLOYMENT_START_TIMEOUT_MS }
      )
      return zStartWorkspaceDeploymentResult.parse(response.data)
    } catch (err) {
      handleAxiosError(err, 'startDeployment')
    }
  },
  async clearDeployment(
    workspaceId: WorkspaceId,
    options: { follow?: 'workspace' } = {},
    signal?: AbortSignal
  ): Promise<void> {
    const auth = await requestAuth()
    try {
      await workspaceApiClient.delete(
        ingestApiUrl(`/workspaces/${workspaceId}/deployment`),
        {
          ...auth,
          ...(signal ? { signal } : {}),
          params: options.follow ? { follow: options.follow } : undefined
        }
      )
    } catch (err) {
      handleAxiosError(err, 'clearDeployment')
    }
  },
  async setDefaultDeployment(
    workspaceId: WorkspaceId,
    payload: PickWorkspaceDeploymentRequest
  ): Promise<void> {
    const auth = await requestAuth()
    try {
      await workspaceApiClient.put(
        ingestApiUrl(`/workspaces/${workspaceId}/default-deployment`),
        payload,
        auth
      )
    } catch (err) {
      handleAxiosError(err, 'setDefaultDeployment')
    }
  },
  async clearDefaultDeployment(workspaceId: WorkspaceId): Promise<void> {
    const auth = await requestAuth()
    try {
      await workspaceApiClient.delete(
        ingestApiUrl(`/workspaces/${workspaceId}/default-deployment`),
        auth
      )
    } catch (err) {
      handleAxiosError(err, 'clearDefaultDeployment')
    }
  },
  async getDeploymentCpuServer(
    workspaceId: WorkspaceId
  ): Promise<WorkspaceDeploymentCpuServer> {
    const auth = await requestAuth()
    try {
      const response = await workspaceApiClient.get<unknown>(
        ingestApiUrl(`/workspaces/${workspaceId}/deployment/cpu-server`),
        { ...auth, timeout: CPU_SERVER_READ_TIMEOUT_MS }
      )
      return zWorkspaceDeploymentCpuServer.parse(response.data)
    } catch (err) {
      handleAxiosError(err, 'getDeploymentCpuServer')
    }
  },
  async getReleaseUnsupportedPacks(): Promise<ReleaseUnsupportedPacks> {
    const auth = await requestAuth()
    try {
      const response = await workspaceApiClient.get<unknown>(
        ingestApiUrl('/release/unsupported-packs'),
        auth
      )
      return zReleaseUnsupportedPacks.parse(response.data)
    } catch (err) {
      handleAxiosError(err, 'getReleaseUnsupportedPacks')
    }
  },
  async checkDeploymentCompatibility(
    workspaceId: WorkspaceId,
    nodeTypes: string[]
  ): Promise<DeploymentCompatibility> {
    const auth = await requestAuth()
    try {
      const response = await workspaceApiClient.post<unknown>(
        ingestApiUrl(`/workspaces/${workspaceId}/deployments/compatibility`),
        { node_types: nodeTypes } satisfies DeploymentCompatibilityRequest,
        auth
      )
      return zDeploymentCompatibility.parse(response.data)
    } catch (err) {
      handleAxiosError(err, 'checkDeploymentCompatibility')
    }
  },
  async delete(workspaceId: WorkspaceId): Promise<void> {
    const auth = await requestAuth()
    try {
      await workspaceApiClient.delete(
        ingestApiUrl(`/workspaces/${workspaceId}`),
        auth
      )
    } catch (err) {
      handleAxiosError(err, 'delete')
    }
  },
  async leave(): Promise<void> {
    const auth = await requestAuth()
    try {
      await workspaceApiClient.post(
        ingestApiUrl('/workspace/leave'),
        null,
        auth
      )
    } catch (err) {
      handleAxiosError(err, 'leave')
    }
  },
  async listMembers(params?: ListMembersParams): Promise<ListMembersResponse> {
    const auth = await requestAuth()
    try {
      const response = await workspaceApiClient.get<ListMembersResponse>(
        ingestApiUrl('/workspace/members'),
        { ...auth, params }
      )
      return response.data
    } catch (err) {
      handleAxiosError(err, 'listMembers')
    }
  },
  async removeMember(userId: UserId): Promise<void> {
    const auth = await requestAuth()
    try {
      await workspaceApiClient.delete(
        ingestApiUrl(`/workspace/members/${userId}`),
        auth
      )
    } catch (err) {
      handleAxiosError(err, 'removeMember')
    }
  },
  async updateMemberRole(userId: UserId, role: WorkspaceRole): Promise<Member> {
    const auth = await requestAuth()
    try {
      const response = await workspaceApiClient.patch<Member>(
        ingestApiUrl(`/workspace/members/${userId}`),
        { role },
        auth
      )
      return response.data
    } catch (err) {
      handleAxiosError(err, 'updateMemberRole')
    }
  },
  async listInvites(): Promise<ListInvitesResponse> {
    const auth = await requestAuth()
    try {
      const response = await workspaceApiClient.get<ListInvitesResponse>(
        ingestApiUrl('/workspace/invites'),
        auth
      )
      return response.data
    } catch (err) {
      handleAxiosError(err, 'listInvites')
    }
  },
  async createInvite(payload: CreateInviteRequest): Promise<PendingInvite> {
    const auth = await requestAuth()
    try {
      const response = await workspaceApiClient.post<PendingInvite>(
        ingestApiUrl('/workspace/invites'),
        payload,
        auth
      )
      return response.data
    } catch (err) {
      handleAxiosError(err, 'createInvite')
    }
  },
  async revokeInvite(inviteId: WorkspaceInviteId): Promise<void> {
    const auth = await requestAuth()
    try {
      await workspaceApiClient.delete(
        ingestApiUrl(`/workspace/invites/${inviteId}`),
        auth
      )
    } catch (err) {
      handleAxiosError(err, 'revokeInvite')
    }
  },
  async resendInvite(inviteId: WorkspaceInviteId): Promise<PendingInvite> {
    const auth = await requestAuth()
    try {
      const response = await workspaceApiClient.post<PendingInvite>(
        ingestApiUrl(
          `/workspace/invites/${encodeURIComponent(inviteId)}/resend`
        ),
        null,
        auth
      )
      return response.data
    } catch (err) {
      handleAxiosError(err, 'resendInvite')
    }
  },
  async acceptInvite(token: string): Promise<AcceptInviteResponse> {
    const headers = await requireWorkspaceApiAuth().getFirebaseAuthHeader()
    try {
      const response = await workspaceApiClient.post<AcceptInviteResponse>(
        ingestApiUrl(`/invites/${token}/accept`),
        null,
        { headers, __skipUnifiedRemint: true }
      )
      return response.data
    } catch (err) {
      handleAxiosError(err, 'acceptInvite')
    }
  }
}
