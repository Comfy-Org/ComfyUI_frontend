import type { UserId } from '@comfyorg/api-client/authTypes'
import type {
  CreateProjectRequest,
  ListProjectMembersResponse,
  ListProjectsResponse,
  Member,
  Project,
  ProjectMember,
  SetProjectMemberRequest,
  UpdateProjectRequest
} from '@comfyorg/ingest-types'

import {
  handleAxiosError,
  ingestApiClient,
  requestAuth
} from '@/platform/remote/ingest/ingestApi'
import { ingestApiUrl } from '@/platform/remote/ingest/ingestApiUrl'

export const projectsApi = {
  async list(): Promise<ListProjectsResponse> {
    const auth = await requestAuth()
    try {
      const response = await ingestApiClient.get<ListProjectsResponse>(
        ingestApiUrl('/projects'),
        auth
      )
      return response.data
    } catch (err) {
      handleAxiosError(err, 'list')
    }
  },
  async get(projectId: string): Promise<Project> {
    const auth = await requestAuth()
    try {
      const response = await ingestApiClient.get<Project>(
        ingestApiUrl(`/projects/${projectId}`),
        auth
      )
      return response.data
    } catch (err) {
      handleAxiosError(err, 'get')
    }
  },
  async create(payload: CreateProjectRequest): Promise<Project> {
    const auth = await requestAuth()
    try {
      const response = await ingestApiClient.post<Project>(
        ingestApiUrl('/projects'),
        payload,
        auth
      )
      return response.data
    } catch (err) {
      handleAxiosError(err, 'create')
    }
  },
  async update(
    projectId: string,
    payload: UpdateProjectRequest
  ): Promise<Project> {
    const auth = await requestAuth()
    try {
      const response = await ingestApiClient.patch<Project>(
        ingestApiUrl(`/projects/${projectId}`),
        payload,
        auth
      )
      return response.data
    } catch (err) {
      handleAxiosError(err, 'update')
    }
  },
  async listMembers(projectId: string): Promise<ListProjectMembersResponse> {
    const auth = await requestAuth()
    try {
      const response = await ingestApiClient.get<ListProjectMembersResponse>(
        ingestApiUrl(`/projects/${projectId}/members`),
        auth
      )
      return response.data
    } catch (err) {
      handleAxiosError(err, 'listMembers')
    }
  },
  async setMember(
    projectId: string,
    userId: UserId,
    payload: SetProjectMemberRequest
  ): Promise<ProjectMember> {
    const auth = await requestAuth()
    try {
      const response = await ingestApiClient.put<ProjectMember>(
        ingestApiUrl(`/projects/${projectId}/members/${userId}`),
        payload,
        auth
      )
      return response.data
    } catch (err) {
      handleAxiosError(err, 'setMember')
    }
  },
  async removeMember(projectId: string, userId: UserId): Promise<void> {
    const auth = await requestAuth()
    try {
      await ingestApiClient.delete(
        ingestApiUrl(`/projects/${projectId}/members/${userId}`),
        auth
      )
    } catch (err) {
      handleAxiosError(err, 'removeMember')
    }
  },
  async grantWorkspaceAdmin(userId: UserId): Promise<Member> {
    const auth = await requestAuth()
    try {
      const response = await ingestApiClient.put<Member>(
        ingestApiUrl(`/workspace/members/${userId}/admin`),
        null,
        auth
      )
      return response.data
    } catch (err) {
      handleAxiosError(err, 'grantWorkspaceAdmin')
    }
  },
  async revokeWorkspaceAdmin(userId: UserId): Promise<Member> {
    const auth = await requestAuth()
    try {
      const response = await ingestApiClient.delete<Member>(
        ingestApiUrl(`/workspace/members/${userId}/admin`),
        auth
      )
      return response.data
    } catch (err) {
      handleAxiosError(err, 'revokeWorkspaceAdmin')
    }
  }
}
