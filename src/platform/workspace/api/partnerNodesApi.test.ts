import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockApiClient, mockGetAuthHeaderOrThrow } = vi.hoisted(() => ({
  mockApiClient: {
    get: vi.fn(),
    patch: vi.fn()
  },
  mockGetAuthHeaderOrThrow: vi.fn()
}))

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => mockApiClient)
  }
}))

vi.mock('@/platform/auth/unified/remintRetry', () => ({
  attachUnifiedRemintInterceptor: vi.fn()
}))

vi.mock('@/scripts/api', () => ({
  api: {
    apiURL: vi.fn((path: string) => `/api${path}`)
  }
}))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({
    getAuthHeaderOrThrow: mockGetAuthHeaderOrThrow
  })
}))

import { partnerNodesApi } from './partnerNodesApi'

const AUTH_HEADER = { Authorization: 'Bearer test-token' }

describe('partnerNodesApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetAuthHeaderOrThrow.mockResolvedValue(AUTH_HEADER)
  })

  it('lists partner-node governance from the workspace resource', async () => {
    const response = { partner_nodes: [], auto_enable_new: false }
    mockApiClient.get.mockResolvedValue({ data: response })

    await expect(partnerNodesApi.list()).resolves.toEqual(response)
    expect(mockApiClient.get).toHaveBeenCalledWith(
      '/api/workspace/partner-nodes',
      { headers: AUTH_HEADER }
    )
  })

  it('updates one node through the bulk mutation contract', async () => {
    mockApiClient.patch.mockResolvedValue({})

    await partnerNodesApi.setEnabled('PartnerNode', false)

    expect(mockApiClient.patch).toHaveBeenCalledWith(
      '/api/workspace/partner-nodes',
      { node_ids: ['PartnerNode'], enabled: false },
      { headers: AUTH_HEADER }
    )
  })

  it('updates a filtered set through the same resource', async () => {
    mockApiClient.patch.mockResolvedValue({})

    await partnerNodesApi.setEnabledBulk(['NodeA', 'NodeB'], true)

    expect(mockApiClient.patch).toHaveBeenCalledWith(
      '/api/workspace/partner-nodes',
      { node_ids: ['NodeA', 'NodeB'], enabled: true },
      { headers: AUTH_HEADER }
    )
  })

  it('updates the default for newly cataloged nodes', async () => {
    mockApiClient.patch.mockResolvedValue({})

    await partnerNodesApi.setAutoEnableNew(true)

    expect(mockApiClient.patch).toHaveBeenCalledWith(
      '/api/workspace/partner-nodes',
      { auto_enable_new: true },
      { headers: AUTH_HEADER }
    )
  })
})
