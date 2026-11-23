import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockAxiosInstance } = vi.hoisted(() => ({
  mockAxiosInstance: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } }
  }
}))

vi.mock<unknown>(import('axios'), () => ({
  default: {
    create: vi.fn(() => mockAxiosInstance),
    isAxiosError: vi.fn((err: unknown) => {
      return (
        err !== null &&
        typeof err === 'object' &&
        'isAxiosError' in err &&
        (err as Record<string, unknown>).isAxiosError === true
      )
    })
  }
}))

vi.mock(import('@/platform/remote/ingest/ingestApiUrl'), () => ({
  ingestApiUrl: (path: string) => `/api${path}`
}))

import { setIngestApiAuth } from '@/platform/remote/ingest/ingestApi'
import type { IngestApiAuth } from '@/platform/remote/ingest/ingestApi'
import { WorkspaceApiError } from '@/platform/remote/ingest/ingestApiError'
import {
  frozenProject,
  listProjectsByRole,
  projectAsOwner,
  projectMembers,
  workspaceAdminMember,
  workspaceMember
} from '@/platform/workspace/api/__fixtures__/projects'
import { pendingBackendMocks } from '@/platform/workspace/api/__fixtures__/projectsPendingBackend'
import { projectsApi } from '@/platform/workspace/api/projectsApi'

const auth = {
  getWorkspaceAuthHeader: vi.fn<IngestApiAuth['getWorkspaceAuthHeader']>(),
  getFirebaseAuthHeader: vi.fn<IngestApiAuth['getFirebaseAuthHeader']>(),
  attachRetryInterceptor: vi.fn()
}

const AUTH_HEADER = { Authorization: 'Bearer test-token' } as const

beforeEach(() => {
  setIngestApiAuth(auth)
  vi.mocked(auth.getWorkspaceAuthHeader).mockResolvedValue(AUTH_HEADER)
})

describe('projectsApi', () => {
  it('propagates error when workspace authentication rejects', async () => {
    const authError = new Error('toastMessages.userNotAuthenticated')
    vi.mocked(auth.getWorkspaceAuthHeader).mockRejectedValue(authError)

    await expect(projectsApi.list()).rejects.toBe(authError)
  })

  it.for([
    {
      name: 'list',
      call: () => projectsApi.list(),
      method: 'get' as const,
      url: '/api/projects',
      body: undefined,
      data: listProjectsByRole.owner
    },
    {
      name: 'get',
      call: () => projectsApi.get('proj-studio'),
      method: 'get' as const,
      url: '/api/projects/proj-studio',
      body: undefined,
      data: projectAsOwner
    },
    {
      name: 'create',
      call: () => projectsApi.create({ name: 'Studio' }),
      method: 'post' as const,
      url: '/api/projects',
      body: { name: 'Studio' },
      data: projectAsOwner
    },
    {
      name: 'update',
      call: () => projectsApi.update('proj-studio', { name: 'Studio 2' }),
      method: 'patch' as const,
      url: '/api/projects/proj-studio',
      body: { name: 'Studio 2' },
      data: { ...projectAsOwner, name: 'Studio 2' }
    },
    {
      name: 'listMembers',
      call: () => projectsApi.listMembers('proj-studio'),
      method: 'get' as const,
      url: '/api/projects/proj-studio/members',
      body: undefined,
      data: projectMembers
    },
    {
      name: 'setMember',
      call: () =>
        projectsApi.setMember('proj-studio', 'user-builder', {
          role: 'builder'
        }),
      method: 'put' as const,
      url: '/api/projects/proj-studio/members/user-builder',
      body: { role: 'builder' },
      data: projectMembers.members[1]
    },
    {
      name: 'grantWorkspaceAdmin',
      call: () => projectsApi.grantWorkspaceAdmin('user-member'),
      method: 'put' as const,
      url: '/api/workspace/members/user-member/admin',
      body: null,
      data: workspaceAdminMember
    },
    {
      name: 'revokeWorkspaceAdmin',
      call: () => projectsApi.revokeWorkspaceAdmin('user-member'),
      method: 'delete' as const,
      url: '/api/workspace/members/user-member/admin',
      body: undefined,
      data: workspaceMember
    }
  ])(
    '$name sends the ingest route and returns the body',
    async ({ call, method, url, body, data }) => {
      mockAxiosInstance[method].mockResolvedValue({ data })

      const result = await call()

      if (method === 'get' || method === 'delete') {
        expect(mockAxiosInstance[method]).toHaveBeenCalledWith(url, {
          headers: AUTH_HEADER
        })
      } else {
        expect(mockAxiosInstance[method]).toHaveBeenCalledWith(url, body, {
          headers: AUTH_HEADER
        })
      }
      expect(result).toEqual(data)
    }
  )

  it('removeMember sends DELETE and returns nothing', async () => {
    mockAxiosInstance.delete.mockResolvedValue({ data: undefined })

    await expect(
      projectsApi.removeMember('proj-studio', 'user-runner')
    ).resolves.toBeUndefined()

    expect(mockAxiosInstance.delete).toHaveBeenCalledWith(
      '/api/projects/proj-studio/members/user-runner',
      { headers: AUTH_HEADER }
    )
  })

  it.for([
    {
      code: 'projects_not_available',
      status: 403,
      call: () => projectsApi.list()
    },
    {
      code: 'project_name_taken',
      status: 409,
      call: () => projectsApi.create({ name: 'Studio' })
    },
    {
      code: 'project_limit_reached',
      status: 409,
      call: () => projectsApi.create({ name: 'Studio' })
    },
    {
      code: 'project_frozen',
      status: 403,
      call: () => projectsApi.update(frozenProject.id, { name: 'Nope' })
    },
    {
      code: 'target_is_owner',
      status: 409,
      call: () => projectsApi.grantWorkspaceAdmin('user-owner')
    }
  ])(
    'surfaces $code from the ingest error body',
    async ({ code, status, call }) => {
      const axiosErr = {
        isAxiosError: true,
        response: {
          headers: {},
          status,
          data: { message: code, code }
        },
        message: 'Request failed'
      }
      mockAxiosInstance.get.mockRejectedValue(axiosErr)
      mockAxiosInstance.post.mockRejectedValue(axiosErr)
      mockAxiosInstance.put.mockRejectedValue(axiosErr)
      mockAxiosInstance.patch.mockRejectedValue(axiosErr)

      await expect(call()).rejects.toMatchObject({
        name: 'WorkspaceApiError',
        status,
        code
      })
    }
  )
})

describe('pending backend mocks', () => {
  it('answers GET /api/workspace/access-events as not found', async () => {
    const error = await pendingBackendMocks
      .listWorkspaceAccessEvents()
      .catch((err: unknown) => err)

    expect(error).toBeInstanceOf(WorkspaceApiError)
    expect(error).toMatchObject({ status: 404, code: 'not_found' })
  })

  it('refuses the m2m authz check', async () => {
    await expect(
      pendingBackendMocks.checkM2mAuthz({
        action: 'deployment.start',
        resource: 'dep-1'
      })
    ).resolves.toEqual({ allowed: false })
  })

  it('stamps comfy-deploy listings with project_id', async () => {
    await expect(
      pendingBackendMocks.listDeploymentsByProjectId('proj-studio')
    ).resolves.toEqual([
      expect.objectContaining({
        deployment_id: 'dep-1',
        project_id: 'proj-studio'
      })
    ])
  })

  it('filters usage reads by project_id', async () => {
    await expect(
      pendingBackendMocks.listUsageByProject('proj-studio')
    ).resolves.toMatchObject({
      project_id: 'proj-studio',
      not_available: { reason: 'no_attribution_source' }
    })
  })
})
