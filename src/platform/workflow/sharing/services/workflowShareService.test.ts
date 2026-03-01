import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useWorkflowShareService } from '@/platform/workflow/sharing/services/workflowShareService'

const mockRootGraph = vi.hoisted(() => ({
  nodes: [] as Partial<LGraphNode>[]
}))

const mockAssetsByNodeType = vi.hoisted(
  () => new Map<string, Partial<AssetItem>[]>()
)
const mockInputAssets = vi.hoisted(() => [] as Partial<AssetItem>[])
const mockUpdateInputs = vi.hoisted(() => vi.fn())

vi.mock('@/stores/nodeDefStore', () => ({
  useNodeDefStore: () => ({
    nodeDefsByName: {
      LoadImage: {
        inputs: {
          image: { type: 'COMBO', image_upload: true }
        }
      },
      LoadAudio: {
        inputs: {
          audio: { type: 'COMBO', audio_upload: true }
        }
      }
    }
  })
}))

const mockApp = vi.hoisted(() => ({
  rootGraph: mockRootGraph as object | null,
  graphToPrompt: vi.fn()
}))

vi.mock('@/scripts/app', () => ({
  app: mockApp
}))

const mockGetShareableAssets = vi.fn()
const mockFetchApi = vi.fn()

vi.mock('@/scripts/api', () => ({
  api: {
    getShareableAssets: (...args: unknown[]) => mockGetShareableAssets(...args),
    fetchApi: (...args: unknown[]) => mockFetchApi(...args),
    apiURL: (route: string) => `/api${route}`,
    fileURL: (route: string) => route
  }
}))

vi.mock('@/stores/modelToNodeStore', () => ({
  useModelToNodeStore: () => ({
    getRegisteredNodeTypes: () => ({
      CheckpointLoaderSimple: 'ckpt_name',
      LoraLoader: 'lora_name'
    })
  })
}))

vi.mock('@/stores/assetsStore', () => ({
  useAssetsStore: () => ({
    inputAssets: mockInputAssets,
    updateInputs: mockUpdateInputs,
    getAssets: (nodeType: string) => mockAssetsByNodeType.get(nodeType) ?? [],
    updateModelsForNodeType: vi.fn(),
    updateModelsForTag: vi.fn()
  })
}))

function createMockNode(
  type: string,
  widgets: { name: string; value: unknown }[] = []
): Partial<LGraphNode> {
  return {
    type,
    widgets: widgets as LGraphNode['widgets'],
    isSubgraphNode: () => false
  } as Partial<LGraphNode>
}

describe(useWorkflowShareService, () => {
  const mockShareableAssets = {
    assets: [{ id: 'asset-1', name: 'asset.png', storage_url: null }],
    models: [{ id: 'model-1', name: 'model.safetensors', storage_url: null }]
  }

  function mockJsonResponse(payload: unknown, ok = true, status = 200) {
    return {
      ok,
      status,
      json: async () => payload
    } as Response
  }

  beforeEach(() => {
    vi.resetAllMocks()
    mockRootGraph.nodes = []
    mockAssetsByNodeType.clear()
    mockInputAssets.splice(0)
    mockUpdateInputs.mockReset()
    mockApp.rootGraph = mockRootGraph
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
        listed: false
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
          assets: [{ id: 'asset-1' }],
          models: [{ id: 'model-1' }]
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
        listed: false
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
        listed: false
      })
    )

    const service = useWorkflowShareService()
    const status = await service.getPublishStatus('wf-1')

    expect(status.isPublished).toBe(true)
    expect(status.shareId).toBe('wf-1')
    expect(status.shareUrl).toBe(`${window.location.origin}/?share=wf-1`)
    expect(status.publishedAt).toBeInstanceOf(Date)
  })

  it('preserves app subpath when normalizing publish status share URLs', async () => {
    window.history.replaceState({}, '', '/comfy/subpath/')
    mockFetchApi.mockResolvedValue(
      mockJsonResponse({
        workflow_id: 'wf-subpath',
        share_id: 'wf-subpath',
        publish_time: '2026-02-23T00:00:00Z',
        listed: false
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

  it('extracts share ID from backend share URL', () => {
    const service = useWorkflowShareService()

    expect(
      service.extractShareId('https://comfy.org/workflows/published/share-1')
    ).toBe('share-1')
  })

  it('returns null when share ID cannot be extracted from URL', () => {
    const service = useWorkflowShareService()

    expect(service.extractShareId('https://comfy.org/workflows')).toBeNull()
  })

  it('fetches and maps shared workflow payload', async () => {
    mockFetchApi.mockResolvedValue(
      mockJsonResponse({
        share_id: 'share-123',
        workflow_id: 'wf-123',
        listed: true,
        publish_time: '2026-02-23T00:00:00Z',
        workflow_json: { nodes: [] },
        imported_assets: [{ id: 'asset-1' }]
      })
    )

    const service = useWorkflowShareService()
    const shared = await service.getSharedWorkflow('share-123')

    expect(mockFetchApi).toHaveBeenCalledWith('/workflows/published/share-123')
    expect(shared).toEqual({
      shareId: 'share-123',
      workflowId: 'wf-123',
      listed: true,
      publishedAt: new Date('2026-02-23T00:00:00Z'),
      workflowJson: { nodes: [] },
      importedAssets: [{ id: 'asset-1' }]
    })
  })

  it('throws when shared workflow request fails', async () => {
    mockFetchApi.mockResolvedValue(mockJsonResponse({}, false, 404))

    const service = useWorkflowShareService()

    await expect(service.getSharedWorkflow('missing')).rejects.toThrow(
      'Failed to load shared workflow: 404'
    )
  })

  it('appends import query param when import option is set', async () => {
    mockFetchApi.mockResolvedValue(
      mockJsonResponse({
        share_id: 'share-import',
        workflow_id: 'wf-import',
        listed: true,
        publish_time: '2026-02-23T00:00:00Z',
        workflow_json: { nodes: [] },
        imported_assets: [{ id: 'imported-1' }]
      })
    )

    const service = useWorkflowShareService()
    await service.getSharedWorkflow('share-import', { import: true })

    expect(mockFetchApi).toHaveBeenCalledWith(
      '/workflows/published/share-import?import=true'
    )
  })

  it('omits import query param when import option is not set', async () => {
    mockFetchApi.mockResolvedValue(
      mockJsonResponse({
        share_id: 'share-no-import',
        workflow_id: 'wf-no-import',
        listed: true,
        publish_time: '2026-02-23T00:00:00Z',
        workflow_json: { nodes: [] },
        imported_assets: []
      })
    )

    const service = useWorkflowShareService()
    await service.getSharedWorkflow('share-no-import')

    expect(mockFetchApi).toHaveBeenCalledWith(
      '/workflows/published/share-no-import'
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
      publishedAt: null
    })
  })

  it('returns empty assets when graph has no asset nodes', async () => {
    mockRootGraph.nodes = [
      createMockNode('KSampler', [{ name: 'seed', value: 42 }])
    ] as LGraphNode[]
    mockApp.graphToPrompt.mockRejectedValue(new Error('fail'))

    const service = useWorkflowShareService()
    const result = await service.getShareableAssets()

    expect(result.assets).toEqual([])
  })

  it('extracts assets from LoadImage nodes', async () => {
    mockRootGraph.nodes = [
      createMockNode('LoadImage', [{ name: 'image', value: 'photo.png' }]),
      createMockNode('LoadAudio', [{ name: 'audio', value: 'clip.wav' }])
    ] as LGraphNode[]
    mockApp.graphToPrompt.mockRejectedValue(new Error('fail'))

    const service = useWorkflowShareService()
    const result = await service.getShareableAssets()

    expect(result.assets).toEqual([
      {
        id: 'photo.png',
        name: 'photo.png',
        storage_url: null,
        thumbnailUrl: '/api/view?filename=photo.png&type=input'
      },
      {
        id: 'clip.wav',
        name: 'clip.wav',
        storage_url: null,
        thumbnailUrl: '/api/view?filename=clip.wav&type=input'
      }
    ])
  })

  it('skips asset nodes with empty widget values', async () => {
    mockRootGraph.nodes = [
      createMockNode('LoadImage', [{ name: 'image', value: '' }]),
      createMockNode('LoadImage', [{ name: 'image', value: 'real.png' }])
    ] as LGraphNode[]
    mockApp.graphToPrompt.mockRejectedValue(new Error('fail'))

    const service = useWorkflowShareService()
    const result = await service.getShareableAssets()

    expect(result.assets).toEqual([
      {
        id: 'real.png',
        name: 'real.png',
        storage_url: null,
        thumbnailUrl: '/api/view?filename=real.png&type=input'
      }
    ])
  })

  it('includes asset thumbnail when matching input asset exists', async () => {
    mockRootGraph.nodes = [
      createMockNode('LoadImage', [{ name: 'image', value: 'photo.png' }])
    ] as LGraphNode[]
    mockInputAssets.push({
      id: 'asset-photo',
      name: 'photo.png',
      preview_url: 'https://example.com/photo-preview.jpg'
    })
    mockApp.graphToPrompt.mockRejectedValue(new Error('fail'))

    const service = useWorkflowShareService()
    const result = await service.getShareableAssets()

    expect(result.assets).toEqual([
      {
        id: 'asset-photo',
        name: 'photo.png',
        storage_url: null,
        thumbnailUrl: 'https://example.com/photo-preview.jpg'
      }
    ])
  })

  it('parses output-marked asset names and builds output previews', async () => {
    mockRootGraph.nodes = [
      createMockNode('LoadImage', [
        { name: 'image', value: 'rendered.png [output]' }
      ])
    ] as LGraphNode[]
    mockApp.graphToPrompt.mockRejectedValue(new Error('fail'))

    const service = useWorkflowShareService()
    const result = await service.getShareableAssets()

    expect(result.assets).toEqual([
      {
        id: 'rendered.png',
        name: 'rendered.png',
        storage_url: null,
        thumbnailUrl: '/api/view?filename=rendered.png&type=output'
      }
    ])
  })

  it('returns empty models when graph has no model loaders', async () => {
    mockRootGraph.nodes = [
      createMockNode('LoadImage', [{ name: 'image', value: 'photo.png' }])
    ] as LGraphNode[]
    mockApp.graphToPrompt.mockRejectedValue(new Error('fail'))

    const service = useWorkflowShareService()
    const result = await service.getShareableAssets()

    expect(result.models).toEqual([])
  })

  it('extracts models from registered loader nodes', async () => {
    mockRootGraph.nodes = [
      createMockNode('CheckpointLoaderSimple', [
        { name: 'ckpt_name', value: 'v1-5-pruned.safetensors' }
      ]),
      createMockNode('LoraLoader', [
        { name: 'lora_name', value: 'detail_tweaker.safetensors' }
      ])
    ] as LGraphNode[]
    mockApp.graphToPrompt.mockRejectedValue(new Error('fail'))

    const service = useWorkflowShareService()
    const result = await service.getShareableAssets()

    expect(result.models).toEqual([
      {
        id: 'v1-5-pruned.safetensors',
        name: 'v1-5-pruned.safetensors',
        storage_url: null,
        thumbnailUrl: null
      },
      {
        id: 'detail_tweaker.safetensors',
        name: 'detail_tweaker.safetensors',
        storage_url: null,
        thumbnailUrl: null
      }
    ])
  })

  it('excludes public (immutable) models from results', async () => {
    mockRootGraph.nodes = [
      createMockNode('CheckpointLoaderSimple', [
        { name: 'ckpt_name', value: 'public-model.safetensors' }
      ]),
      createMockNode('LoraLoader', [
        { name: 'lora_name', value: 'my-lora.safetensors' }
      ])
    ] as LGraphNode[]

    mockAssetsByNodeType.set('CheckpointLoaderSimple', [
      {
        name: 'public-model.safetensors',
        id: 'public-model-id',
        is_immutable: true,
        preview_url: 'https://example.com/public.jpg'
      }
    ])
    mockAssetsByNodeType.set('LoraLoader', [
      {
        name: 'my-lora.safetensors',
        id: 'my-lora-id',
        is_immutable: false,
        preview_url: 'https://example.com/lora.jpg'
      }
    ])
    mockApp.graphToPrompt.mockRejectedValue(new Error('fail'))

    const service = useWorkflowShareService()
    const result = await service.getShareableAssets()

    expect(result.models).toEqual([
      {
        id: 'my-lora-id',
        name: 'my-lora.safetensors',
        storage_url: null,
        thumbnailUrl: 'https://example.com/lora.jpg'
      }
    ])
  })

  it('includes models not found in assets cache', async () => {
    mockRootGraph.nodes = [
      createMockNode('CheckpointLoaderSimple', [
        { name: 'ckpt_name', value: 'uncached-model.safetensors' }
      ])
    ] as LGraphNode[]
    mockApp.graphToPrompt.mockRejectedValue(new Error('fail'))

    const service = useWorkflowShareService()
    const result = await service.getShareableAssets()

    expect(result.models).toEqual([
      {
        id: 'uncached-model.safetensors',
        name: 'uncached-model.safetensors',
        storage_url: null,
        thumbnailUrl: null
      }
    ])
  })

  it('includes LoRA models from unregistered loader nodes via global model assets', async () => {
    mockRootGraph.nodes = [
      createMockNode('PowerLoraLoader', [
        { name: 'lora_model', value: 'detail_tweaker.safetensors' }
      ])
    ] as LGraphNode[]
    mockAssetsByNodeType.set('tag:models', [
      {
        name: 'detail_tweaker.safetensors',
        id: 'lora-global-id',
        is_immutable: false,
        preview_url: 'https://example.com/lora-preview.jpg'
      }
    ])
    mockApp.graphToPrompt.mockRejectedValue(new Error('fail'))

    const service = useWorkflowShareService()
    const result = await service.getShareableAssets()

    expect(result.models).toEqual([
      {
        id: 'lora-global-id',
        name: 'detail_tweaker.safetensors',
        storage_url: null,
        thumbnailUrl: 'https://example.com/lora-preview.jpg'
      }
    ])
  })

  it('includes model thumbnails when model assets provide preview URLs', async () => {
    mockRootGraph.nodes = [
      createMockNode('CheckpointLoaderSimple', [
        { name: 'ckpt_name', value: 'preview-model.safetensors' }
      ])
    ] as LGraphNode[]
    mockAssetsByNodeType.set('CheckpointLoaderSimple', [
      {
        name: 'preview-model.safetensors',
        id: 'preview-model-id',
        is_immutable: false,
        preview_url: 'https://example.com/model-preview.jpg'
      }
    ])
    mockApp.graphToPrompt.mockRejectedValue(new Error('fail'))

    const service = useWorkflowShareService()
    const result = await service.getShareableAssets()

    expect(result.models).toEqual([
      {
        id: 'preview-model-id',
        name: 'preview-model.safetensors',
        storage_url: null,
        thumbnailUrl: 'https://example.com/model-preview.jpg'
      }
    ])
  })

  it('returns empty results when no graph exists', async () => {
    mockApp.rootGraph = null

    const service = useWorkflowShareService()
    const result = await service.getShareableAssets()

    expect(result).toEqual({ assets: [], models: [] })
    expect(mockApp.graphToPrompt).not.toHaveBeenCalled()
  })

  it('calls onRefine with backend results when API succeeds', async () => {
    mockRootGraph.nodes = [
      createMockNode('LoadImage', [{ name: 'image', value: 'photo.png' }])
    ] as LGraphNode[]

    const backendResult = {
      assets: [
        {
          id: 'backend-photo-id',
          name: 'photo.png',
          storage_url: '/storage/backend-photo',
          thumbnailUrl: '/storage/backend-photo'
        }
      ],
      models: []
    }
    mockApp.graphToPrompt.mockResolvedValue({ output: { '1': {} } })
    mockGetShareableAssets.mockResolvedValue(backendResult)

    const onRefine = vi.fn()
    const service = useWorkflowShareService()
    const result = await service.getShareableAssets(onRefine)

    await vi.waitFor(() => expect(onRefine).toHaveBeenCalledWith(backendResult))

    expect(result.assets).toEqual([
      {
        id: 'photo.png',
        name: 'photo.png',
        storage_url: null,
        thumbnailUrl: '/api/view?filename=photo.png&type=input'
      }
    ])
  })

  it('does not call onRefine when API fails', async () => {
    mockRootGraph.nodes = [
      createMockNode('LoadImage', [{ name: 'image', value: 'photo.png' }])
    ] as LGraphNode[]
    mockApp.graphToPrompt.mockRejectedValue(new Error('fail'))

    const onRefine = vi.fn()
    const service = useWorkflowShareService()
    await service.getShareableAssets(onRefine)

    expect(onRefine).not.toHaveBeenCalled()
  })

  it('awaits backend call when no onRefine callback is provided', async () => {
    mockRootGraph.nodes = [] as LGraphNode[]
    mockApp.graphToPrompt.mockResolvedValue({ output: {} })
    mockGetShareableAssets.mockResolvedValue({ assets: [], models: [] })

    const service = useWorkflowShareService()
    await service.getShareableAssets()

    expect(mockGetShareableAssets).toHaveBeenCalledWith({})
  })

  it('normalizes backend thumbnail field names', async () => {
    mockRootGraph.nodes = [] as LGraphNode[]
    mockApp.graphToPrompt.mockResolvedValue({ output: {} })
    mockGetShareableAssets.mockResolvedValue({
      assets: [
        {
          id: 'asset-server-1',
          name: 'server-asset.png',
          thumbnail_url: 'https://example.com/a.jpg'
        }
      ],
      models: [
        {
          id: 'model-server-1',
          name: 'server-model.safetensors',
          preview_url: 'https://example.com/m.jpg'
        }
      ]
    } as unknown)

    const service = useWorkflowShareService()
    const result = await service.getShareableAssets()

    expect(result).toEqual({
      assets: [
        {
          id: 'asset-server-1',
          name: 'server-asset.png',
          storage_url: null,
          thumbnailUrl: 'https://example.com/a.jpg'
        }
      ],
      models: [
        {
          id: 'model-server-1',
          name: 'server-model.safetensors',
          storage_url: null,
          thumbnailUrl: 'https://example.com/m.jpg'
        }
      ]
    })
  })

  it('normalizes relative backend thumbnail URLs', async () => {
    mockRootGraph.nodes = [] as LGraphNode[]
    mockApp.graphToPrompt.mockResolvedValue({ output: {} })
    mockGetShareableAssets.mockResolvedValue({
      assets: [
        {
          id: 'asset-1',
          name: 'asset.png',
          thumbnail: '/view?filename=asset.png'
        }
      ],
      models: [
        {
          id: 'model-1',
          name: 'model.safetensors',
          preview: '/api/assets/model-thumb'
        }
      ]
    } as unknown)

    const service = useWorkflowShareService()
    const result = await service.getShareableAssets()

    expect(result).toEqual({
      assets: [
        {
          id: 'asset-1',
          name: 'asset.png',
          storage_url: null,
          thumbnailUrl: '/api/view?filename=asset.png'
        }
      ],
      models: [
        {
          id: 'model-1',
          name: 'model.safetensors',
          storage_url: null,
          thumbnailUrl: '/api/assets/model-thumb'
        }
      ]
    })
  })
})
