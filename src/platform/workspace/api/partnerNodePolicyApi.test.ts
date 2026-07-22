import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  getPartnerNodePolicy,
  getPartnerProviders,
  PartnerNodePolicyApiError
} from '@/platform/workspace/api/partnerNodePolicyApi'

const mockFetchApi = vi.fn()

vi.mock('@/scripts/api', () => ({
  api: {
    fetchApi: (...args: unknown[]) => mockFetchApi(...args)
  }
}))

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), init)
}

describe('partnerNodePolicyApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('normalizes the provider catalog', async () => {
    mockFetchApi.mockResolvedValue(
      jsonResponse({
        providers: [
          {
            provider_id: 'openai',
            display_name: 'OpenAI (inc. Sora)',
            node_categories: ['OpenAI', 'Sora']
          }
        ]
      })
    )

    await expect(getPartnerProviders()).resolves.toEqual([
      {
        id: 'openai',
        displayName: 'OpenAI (inc. Sora)',
        nodeCategories: ['OpenAI', 'Sora']
      }
    ])
    expect(mockFetchApi).toHaveBeenCalledWith('/providers', {
      cache: 'no-store'
    })
  })

  it('normalizes the configured policy response', async () => {
    mockFetchApi.mockResolvedValue(
      jsonResponse({
        enforcement_enabled: true,
        nodes: { AllowedNode: true, DisabledNode: false }
      })
    )

    await expect(getPartnerNodePolicy()).resolves.toEqual({
      enforcementEnabled: true,
      nodes: { AllowedNode: true, DisabledNode: false }
    })
    expect(mockFetchApi).toHaveBeenCalledWith(
      '/workspace/partner-node-policy',
      { cache: 'no-store' }
    )
  })

  it('maps 404 to an unconfigured policy', async () => {
    mockFetchApi.mockResolvedValue(
      jsonResponse({}, { status: 404, statusText: 'Not Found' })
    )

    await expect(getPartnerNodePolicy()).resolves.toBeNull()
  })

  it('preserves non-404 status codes for policy decisions', async () => {
    mockFetchApi.mockResolvedValue(
      jsonResponse({}, { status: 503, statusText: 'Service Unavailable' })
    )

    await expect(getPartnerNodePolicy()).rejects.toEqual(
      new PartnerNodePolicyApiError(503, 'Service Unavailable')
    )
  })

  it('rejects malformed policy responses', async () => {
    mockFetchApi.mockResolvedValue(
      jsonResponse({ enforcement_enabled: 'yes', nodes: [] })
    )

    await expect(getPartnerNodePolicy()).rejects.toMatchObject({
      name: 'ZodError'
    })
  })
})
