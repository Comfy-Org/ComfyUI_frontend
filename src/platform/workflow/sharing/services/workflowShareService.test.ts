import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AssetInfo } from '@/schemas/apiSchema'
import { useWorkflowShareService } from '@/platform/workflow/sharing/services/workflowShareService'

const mockApp = vi.hoisted(() => ({
  rootGraph: {} as object | null,
  graphToPrompt: vi.fn()
}))

vi.mock('@/scripts/app', () => ({
  app: mockApp
}))

const mockGetShareableAssets = vi.fn()
const mockFetchApi = vi.fn()

vi.mock(
  '@/platform/workflow/validation/schemas/workflowSchema',
  async (importOriginal) => ({
    ...(await importOriginal()),
    validateComfyWorkflow: vi.fn(async (json: unknown) => json)
  })
)

vi.mock('@/scripts/api', () => ({
  api: {
    getShareableAssets: (...args: unknown[]) => mockGetShareableAssets(...args),
    fetchApi: (...args: unknown[]) => mockFetchApi(...args),
    apiURL: (route: string) => `/api${route}`,
    fileURL: (route: string) => route
  }
}))

describe(useWorkflowShareService, () => {
  const mockShareableAssets: AssetInfo[] = [
    {
      id: 'asset-1',
      name: 'asset.png',
      storage_url: '',
      preview_url: '',
      model: false,
      public: false,
      in_library: false
    },
    {
      id: 'model-1',
      name: 'model.safetensors',
      storage_url: '',
      preview_url: '',
      model: true,
      public: false,
      in_library: false
    }
  ]

  function mockJsonResponse(payload: unknown, ok = true, status = 200) {
    return {
      ok,
      status,
      json: async () => payload
    } as Response
  }

  beforeEach(() => {
    vi.resetAllMocks()
    mockApp.rootGraph = {}
    window.history.replaceState({}, '', '/')
  })

  it('returns unpublished status for unknown workflow', async () => {
    mockFetchApi.mockResolvedValue(
      mockJsonResponse({
        workflow_id: 'wf-0',
        publish_time: null,
        share_id: null,
        listed: false
      })
    )

    const service = useWorkflowShareService()
    const status = await service.getPublishStatus('unknown-id')

    expect(status.isPublished).toBe(false)
    expect(status.shareId).toBeNull()
    expect(status.shareUrl).toBeNull()
    expect(status.publishedAt).toBeNull()
  })

  it('publishes a workflow and returns a share URL', async () => {
    mockFetchApi.mockResolvedValue(
      mockJsonResponse({
        workflow_id: 'test-workflow',
        share_id: 'abc123',
        publish_time: '2026-02-23T00:00:00Z',
        listed: false,
        assets: []
      })
    )

    const service = useWorkflowShareService()

    const result = await service.publishWorkflow(
      'test-workflow',
      mockShareableAssets
    )

    expect(result.shareId).toBe('abc123')
    expect(result.shareUrl).toBe(`${window.location.origin}/?share=abc123`)
    expect(result.publishedAt).toBeInstanceOf(Date)
    expect(mockFetchApi).toHaveBeenCalledWith(
      '/userdata/test-workflow/publish',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset_ids: ['asset-1', 'model-1']
        })
      }
    )
  })

  it('preserves app subpath when normalizing published share URLs', async () => {
    window.history.replaceState({}, '', '/comfy/subpath/?foo=bar#section')
    mockFetchApi.mockResolvedValue(
      mockJsonResponse({
        workflow_id: 'test-workflow',
        share_id: 'subpath-id',
        publish_time: '2026-02-23T00:00:00Z',
        listed: false,
        assets: []
      })
    )

    const service = useWorkflowShareService()
    const result = await service.publishWorkflow(
      'test-workflow',
      mockShareableAssets
    )

    expect(result.shareUrl).toBe(
      `${window.location.origin}/comfy/subpath/?share=subpath-id`
    )
  })

  it('reports published status after publishing', async () => {
    mockFetchApi.mockResolvedValue(
      mockJsonResponse({
        workflow_id: 'wf-1',
        share_id: 'wf-1',
        publish_time: '2026-02-23T00:00:00Z',
        listed: false,
        assets: []
      })
    )

    const service = useWorkflowShareService()
    const status = await service.getPublishStatus('wf-1')

    expect(status.isPublished).toBe(true)
    expect(status.shareId).toBe('wf-1')
    expect(status.shareUrl).toBe(`${window.location.origin}/?share=wf-1`)
    expect(status.publishedAt).toBeInstanceOf(Date)
  })

  it('includes prefill data from hub workflow details', async () => {
    mockFetchApi.mockImplementation(async (path: string) => {
      if (path === '/userdata/wf-prefill/publish') {
        return mockJsonResponse({
          workflow_id: 'wf-prefill',
          share_id: 'wf-prefill',
          publish_time: '2026-02-23T00:00:00Z',
          listed: true
        })
      }

      if (path === '/hub/workflows/wf-prefill') {
        return mockJsonResponse({
          description: 'A cool workflow',
          tags: ['art', 'upscale'],
          thumbnail_type: 'image_comparison',
          sample_image_urls: ['https://example.com/img1.png']
        })
      }

      return mockJsonResponse({}, false, 404)
    })

    const service = useWorkflowShareService()
    const status = await service.getPublishStatus('wf-prefill')

    expect(status.isPublished).toBe(true)
    expect(status.prefill).toEqual({
      description: 'A cool workflow',
      tags: ['art', 'upscale'],
      thumbnailType: 'imageComparison',
      sampleImageUrls: ['https://example.com/img1.png']
    })
    expect(mockFetchApi).toHaveBeenNthCalledWith(2, '/hub/workflows/wf-prefill')
  })

  it('returns null prefill when hub workflow details are unavailable', async () => {
    mockFetchApi.mockImplementation(async (path: string) => {
      if (path === '/userdata/wf-no-meta/publish') {
        return mockJsonResponse({
          workflow_id: 'wf-no-meta',
          share_id: 'wf-no-meta',
          publish_time: '2026-02-23T00:00:00Z',
          listed: true
        })
      }

      return mockJsonResponse({}, false, 500)
    })

    const service = useWorkflowShareService()
    const status = await service.getPublishStatus('wf-no-meta')

    expect(status.isPublished).toBe(true)
    expect(status.prefill).toBeNull()
  })

  it('does not fetch hub workflow details when publish record is unlisted', async () => {
    mockFetchApi.mockResolvedValue(
      mockJsonResponse({
        workflow_id: 'wf-unlisted',
        share_id: 'wf-unlisted',
        publish_time: '2026-02-23T00:00:00Z',
        listed: false
      })
    )

    const service = useWorkflowShareService()
    const status = await service.getPublishStatus('wf-unlisted')

    expect(status.isPublished).toBe(true)
    expect(status.prefill).toBeNull()
    expect(mockFetchApi).toHaveBeenCalledTimes(1)
    expect(mockFetchApi).toHaveBeenCalledWith('/userdata/wf-unlisted/publish')
  })

  it('preserves app subpath when normalizing publish status share URLs', async () => {
    window.history.replaceState({}, '', '/comfy/subpath/')
    mockFetchApi.mockResolvedValue(
      mockJsonResponse({
        workflow_id: 'wf-subpath',
        share_id: 'wf-subpath',
        publish_time: '2026-02-23T00:00:00Z',
        listed: false,
        assets: []
      })
    )

    const service = useWorkflowShareService()
    const status = await service.getPublishStatus('wf-subpath')

    expect(status.shareUrl).toBe(
      `${window.location.origin}/comfy/subpath/?share=wf-subpath`
    )
  })

  it('returns unpublished when publish record has no share id', async () => {
    mockFetchApi.mockResolvedValue(
      mockJsonResponse({
        workflow_id: 'wf-2',
        share_id: null,
        publish_time: '2026-02-23T00:00:00Z',
        listed: false
      })
    )

    const service = useWorkflowShareService()
    const status = await service.getPublishStatus('wf-2')

    expect(status.isPublished).toBe(false)
    expect(status.shareId).toBeNull()
  })

  it('fetches and maps shared workflow payload', async () => {
    mockFetchApi.mockResolvedValue(
      mockJsonResponse({
        share_id: 'share-123',
        workflow_id: 'wf-123',
        name: 'Test Workflow',
        listed: true,
        publish_time: '2026-02-23T00:00:00Z',
        workflow_json: { nodes: [] },
        assets: [
          {
            id: 'asset-1',
            name: 'asset.png',
            preview_url: 'https://example.com/a.jpg',
            storage_url: 'storage/a',
            model: false,
            public: false,
            in_library: false
          }
        ]
      })
    )

    const service = useWorkflowShareService()
    const shared = await service.getSharedWorkflow('share-123')

    expect(mockFetchApi).toHaveBeenCalledWith('/workflows/published/share-123')
    expect(shared).toEqual({
      shareId: 'share-123',
      workflowId: 'wf-123',
      name: 'Test Workflow',
      listed: true,
      publishedAt: new Date('2026-02-23T00:00:00Z'),
      workflowJson: { nodes: [] },
      assets: [
        {
          id: 'asset-1',
          name: 'asset.png',
          preview_url: 'https://example.com/a.jpg',
          storage_url: 'storage/a',
          model: false,
          public: false,
          in_library: false
        }
      ]
    })
  })

  it('throws when shared workflow request fails', async () => {
    mockFetchApi.mockResolvedValue(mockJsonResponse({}, false, 404))

    const service = useWorkflowShareService()

    await expect(service.getSharedWorkflow('missing')).rejects.toThrow(
      'Failed to load shared workflow: 404'
    )
  })

  it('imports published assets via POST /assets/import', async () => {
    mockFetchApi.mockResolvedValue(mockJsonResponse({}, true, 200))

    const service = useWorkflowShareService()
    await service.importPublishedAssets(['pa-1', 'pa-2'])

    expect(mockFetchApi).toHaveBeenCalledWith('/assets/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ published_asset_ids: ['pa-1', 'pa-2'] })
    })
  })

  it('throws when import request fails', async () => {
    mockFetchApi.mockResolvedValue(mockJsonResponse({}, false, 400))

    const service = useWorkflowShareService()

    await expect(service.importPublishedAssets(['bad-id'])).rejects.toThrow(
      'Failed to import assets: 400'
    )
  })

  it('throws when shared workflow payload is invalid', async () => {
    mockFetchApi.mockResolvedValue(
      mockJsonResponse({ name: 'Invalid', version: 1 })
    )

    const service = useWorkflowShareService()

    await expect(service.getSharedWorkflow('invalid')).rejects.toThrow(
      'Failed to load shared workflow: invalid response'
    )
  })

  it('treats malformed publish-status payload as unpublished', async () => {
    mockFetchApi.mockResolvedValue(mockJsonResponse({ is_published: true }))

    const service = useWorkflowShareService()
    const status = await service.getPublishStatus('wf-4')

    expect(status).toEqual({
      isPublished: false,
      shareId: null,
      shareUrl: null,
      publishedAt: null,
      prefill: null
    })
  })

  it('returns empty results when no graph exists', async () => {
    mockApp.rootGraph = null

    const service = useWorkflowShareService()
    const result = await service.getShareableAssets()

    expect(result).toEqual([])
    expect(mockApp.graphToPrompt).not.toHaveBeenCalled()
  })

  it('calls backend API with graph prompt output', async () => {
    mockApp.graphToPrompt.mockResolvedValue({ output: { '1': {} } })
    mockGetShareableAssets.mockResolvedValue({ assets: [] })

    const service = useWorkflowShareService()
    await service.getShareableAssets()

    expect(mockGetShareableAssets).toHaveBeenCalledWith({ '1': {} })
  })

  it('propagates error when graphToPrompt fails', async () => {
    mockApp.graphToPrompt.mockRejectedValue(new Error('prompt failed'))

    const service = useWorkflowShareService()

    await expect(service.getShareableAssets()).rejects.toThrow('prompt failed')
  })

  it('normalizes backend thumbnail field names', async () => {
    mockApp.graphToPrompt.mockResolvedValue({ output: {} })
    mockGetShareableAssets.mockResolvedValue({
      assets: [
        {
          id: 'asset-server-1',
          name: 'server-asset.png',
          preview_url: 'https://example.com/a.jpg',
          storage_url: 'storage/a',
          model: false,
          public: false,
          in_library: false
        },
        {
          id: 'model-server-1',
          name: 'server-model.safetensors',
          preview_url: 'https://example.com/m.jpg',
          storage_url: 'storage/m',
          model: true,
          public: false,
          in_library: true
        }
      ]
    })

    const service = useWorkflowShareService()
    const result = await service.getShareableAssets()

    expect(result).toEqual([
      {
        id: 'asset-server-1',
        name: 'server-asset.png',
        preview_url: 'https://example.com/a.jpg',
        storage_url: 'storage/a',
        model: false,
        public: false,
        in_library: false
      },
      {
        id: 'model-server-1',
        name: 'server-model.safetensors',
        preview_url: 'https://example.com/m.jpg',
        storage_url: 'storage/m',
        model: true,
        public: false,
        in_library: true
      }
    ])
  })

  it('returns assets with preview_url intact', async () => {
    mockApp.graphToPrompt.mockResolvedValue({ output: {} })
    mockGetShareableAssets.mockResolvedValue({
      assets: [
        {
          id: 'asset-1',
          name: 'asset.png',
          preview_url: '/view?filename=asset.png',
          storage_url: 'storage/asset',
          model: false,
          public: false,
          in_library: false
        },
        {
          id: 'model-1',
          name: 'model.safetensors',
          preview_url: '/api/assets/model-thumb',
          storage_url: 'storage/model',
          model: true,
          public: false,
          in_library: false
        }
      ]
    })

    const service = useWorkflowShareService()
    const result = await service.getShareableAssets()

    expect(result).toEqual([
      {
        id: 'asset-1',
        name: 'asset.png',
        preview_url: '/view?filename=asset.png',
        storage_url: 'storage/asset',
        model: false,
        public: false,
        in_library: false
      },
      {
        id: 'model-1',
        name: 'model.safetensors',
        preview_url: '/api/assets/model-thumb',
        storage_url: 'storage/model',
        model: true,
        public: false,
        in_library: false
      }
    ])
  })
})
