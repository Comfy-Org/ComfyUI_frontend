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

describe('useWorkflowShareService', () => {
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
        is_published: false,
        share_url: null,
        published_at: null
      })
    )

    const service = useWorkflowShareService()
    const status = await service.getPublishStatus('unknown-id', 1000)

    expect(status.isPublished).toBe(false)
    expect(status.shareUrl).toBeNull()
    expect(status.publishedAt).toBeNull()
    expect(status.hasChangesSincePublish).toBe(false)
  })

  it('publishes a workflow and returns a share URL', async () => {
    mockFetchApi.mockResolvedValue(
      mockJsonResponse({
        share_url: 'https://comfy.org/workflows/shares/abc123',
        published_at: '2026-02-23T00:00:00Z'
      })
    )

    const service = useWorkflowShareService()

    const result = await service.publishWorkflow('test-workflow', 1000)

    expect(result.shareUrl).toBe(`${window.location.origin}/?share=abc123`)
    expect(result.publishedAt).toBeInstanceOf(Date)
    expect(mockFetchApi).toHaveBeenCalledWith('/workflows/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workflow_path: 'test-workflow', saved_at: 1000 })
    })
  })

  it('normalizes ISO workflow save timestamp before publishing', async () => {
    mockFetchApi.mockResolvedValue(
      mockJsonResponse({
        share_url: 'https://comfy.org/workflows/shares/iso',
        published_at: '2026-02-23T00:00:00Z'
      })
    )

    const service = useWorkflowShareService()
    const savedAtIso = '2026-02-23T21:47:29.369842552Z'

    await service.publishWorkflow('test-workflow', savedAtIso)

    expect(mockFetchApi).toHaveBeenCalledWith('/workflows/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workflow_path: 'test-workflow',
        saved_at: Date.parse(savedAtIso)
      })
    })
  })

  it('preserves app subpath when normalizing published share URLs', async () => {
    window.history.replaceState({}, '', '/comfy/subpath/?foo=bar#section')
    mockFetchApi.mockResolvedValue(
      mockJsonResponse({
        share_url: 'https://comfy.org/workflows/shares/subpath-id',
        published_at: '2026-02-23T00:00:00Z'
      })
    )

    const service = useWorkflowShareService()
    const result = await service.publishWorkflow('test-workflow', 1000)

    expect(result.shareUrl).toBe(
      `${window.location.origin}/comfy/subpath/?share=subpath-id`
    )
  })

  it('reports published status after publishing', async () => {
    mockFetchApi.mockResolvedValue(
      mockJsonResponse({
        is_published: true,
        share_url: 'https://comfy.org/workflows/shares/wf-1',
        published_at: '2026-02-23T00:00:00Z',
        saved_at: 1000
      })
    )

    const service = useWorkflowShareService()
    const status = await service.getPublishStatus('wf-1', 1000)

    expect(status.isPublished).toBe(true)
    expect(status.shareUrl).toBe(`${window.location.origin}/?share=wf-1`)
    expect(status.publishedAt).toBeInstanceOf(Date)
    expect(status.hasChangesSincePublish).toBe(false)
  })

  it('preserves app subpath when normalizing publish status share URLs', async () => {
    window.history.replaceState({}, '', '/comfy/subpath/')
    mockFetchApi.mockResolvedValue(
      mockJsonResponse({
        is_published: true,
        share_url: 'https://comfy.org/workflows/shares/wf-subpath',
        published_at: '2026-02-23T00:00:00Z',
        saved_at: 1000
      })
    )

    const service = useWorkflowShareService()
    const status = await service.getPublishStatus('wf-subpath', 1000)

    expect(status.shareUrl).toBe(
      `${window.location.origin}/comfy/subpath/?share=wf-subpath`
    )
  })

  it('detects changes when workflow was saved after publish', async () => {
    mockFetchApi.mockResolvedValue(
      mockJsonResponse({
        is_published: true,
        share_url: 'https://comfy.org/workflows/shares/wf-2',
        published_at: '2026-02-23T00:00:00Z',
        saved_at: 1000
      })
    )

    const service = useWorkflowShareService()
    const status = await service.getPublishStatus('wf-2', 2000)

    expect(status.hasChangesSincePublish).toBe(true)
  })

  it('detects changes when current save timestamp is an ISO string', async () => {
    mockFetchApi.mockResolvedValue(
      mockJsonResponse({
        is_published: true,
        share_url: 'https://comfy.org/workflows/shares/wf-iso',
        published_at: '2026-02-23T00:00:00Z',
        saved_at: 1000
      })
    )

    const service = useWorkflowShareService()
    const status = await service.getPublishStatus(
      'wf-iso',
      '2026-02-23T00:00:05.000Z'
    )

    expect(status.hasChangesSincePublish).toBe(true)
  })

  it('reports no changes when workflow has not been saved since publish', async () => {
    mockFetchApi.mockResolvedValue(
      mockJsonResponse({
        is_published: true,
        share_url: 'https://comfy.org/workflows/shares/wf-3',
        published_at: '2026-02-23T00:00:00Z',
        saved_at: 1000
      })
    )

    const service = useWorkflowShareService()
    const status = await service.getPublishStatus('wf-3', 1000)

    expect(status.hasChangesSincePublish).toBe(false)
  })

  it('extracts share ID from backend share URL', () => {
    const service = useWorkflowShareService()

    expect(
      service.extractShareId('https://comfy.org/workflows/shares/share-1')
    ).toBe('share-1')
  })

  it('returns null when share ID cannot be extracted from URL', () => {
    const service = useWorkflowShareService()

    expect(service.extractShareId('https://comfy.org/workflows')).toBeNull()
  })

  it('fetches and maps shared workflow payload', async () => {
    mockFetchApi.mockResolvedValue(
      mockJsonResponse({
        name: 'Shared Workflow',
        description: 'A shared workflow',
        workflow_json: { nodes: [] },
        version: 2
      })
    )

    const service = useWorkflowShareService()
    const shared = await service.getSharedWorkflow('share-123')

    expect(mockFetchApi).toHaveBeenCalledWith('/workflows/shares/share-123')
    expect(shared).toEqual({
      name: 'Shared Workflow',
      description: 'A shared workflow',
      workflowJson: { nodes: [] },
      version: 2
    })
  })

  it('throws when shared workflow request fails', async () => {
    mockFetchApi.mockResolvedValue(mockJsonResponse({}, false, 404))

    const service = useWorkflowShareService()

    await expect(service.getSharedWorkflow('missing')).rejects.toThrow(
      'Failed to load shared workflow: 404'
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
    const status = await service.getPublishStatus('wf-4', 1000)

    expect(status).toEqual({
      isPublished: false,
      shareUrl: null,
      publishedAt: null,
      hasChangesSincePublish: false
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
        name: 'photo.png',
        thumbnailUrl: '/api/view?filename=photo.png&type=input'
      },
      {
        name: 'clip.wav',
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
        name: 'real.png',
        thumbnailUrl: '/api/view?filename=real.png&type=input'
      }
    ])
  })

  it('includes asset thumbnail when matching input asset exists', async () => {
    mockRootGraph.nodes = [
      createMockNode('LoadImage', [{ name: 'image', value: 'photo.png' }])
    ] as LGraphNode[]
    mockInputAssets.push({
      name: 'photo.png',
      preview_url: 'https://example.com/photo-preview.jpg'
    })
    mockApp.graphToPrompt.mockRejectedValue(new Error('fail'))

    const service = useWorkflowShareService()
    const result = await service.getShareableAssets()

    expect(result.assets).toEqual([
      {
        name: 'photo.png',
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
        name: 'rendered.png',
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
      { name: 'v1-5-pruned.safetensors', thumbnailUrl: null },
      { name: 'detail_tweaker.safetensors', thumbnailUrl: null }
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
        is_immutable: true,
        preview_url: 'https://example.com/public.jpg'
      }
    ])
    mockAssetsByNodeType.set('LoraLoader', [
      {
        name: 'my-lora.safetensors',
        is_immutable: false,
        preview_url: 'https://example.com/lora.jpg'
      }
    ])
    mockApp.graphToPrompt.mockRejectedValue(new Error('fail'))

    const service = useWorkflowShareService()
    const result = await service.getShareableAssets()

    expect(result.models).toEqual([
      {
        name: 'my-lora.safetensors',
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
      { name: 'uncached-model.safetensors', thumbnailUrl: null }
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
        is_immutable: false,
        preview_url: 'https://example.com/lora-preview.jpg'
      }
    ])
    mockApp.graphToPrompt.mockRejectedValue(new Error('fail'))

    const service = useWorkflowShareService()
    const result = await service.getShareableAssets()

    expect(result.models).toEqual([
      {
        name: 'detail_tweaker.safetensors',
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
        is_immutable: false,
        preview_url: 'https://example.com/model-preview.jpg'
      }
    ])
    mockApp.graphToPrompt.mockRejectedValue(new Error('fail'))

    const service = useWorkflowShareService()
    const result = await service.getShareableAssets()

    expect(result.models).toEqual([
      {
        name: 'preview-model.safetensors',
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
        { name: 'photo.png', thumbnailUrl: 'https://example.com/t.jpg' }
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
        name: 'photo.png',
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
        { name: 'server-asset.png', thumbnail_url: 'https://example.com/a.jpg' }
      ],
      models: [
        {
          name: 'server-model.safetensors',
          preview_url: 'https://example.com/m.jpg'
        }
      ]
    } as unknown)

    const service = useWorkflowShareService()
    const result = await service.getShareableAssets()

    expect(result).toEqual({
      assets: [
        { name: 'server-asset.png', thumbnailUrl: 'https://example.com/a.jpg' }
      ],
      models: [
        {
          name: 'server-model.safetensors',
          thumbnailUrl: 'https://example.com/m.jpg'
        }
      ]
    })
  })

  it('normalizes relative backend thumbnail URLs', async () => {
    mockRootGraph.nodes = [] as LGraphNode[]
    mockApp.graphToPrompt.mockResolvedValue({ output: {} })
    mockGetShareableAssets.mockResolvedValue({
      assets: [{ name: 'asset.png', thumbnail: '/view?filename=asset.png' }],
      models: [
        {
          name: 'model.safetensors',
          preview: '/api/assets/model-thumb'
        }
      ]
    } as unknown)

    const service = useWorkflowShareService()
    const result = await service.getShareableAssets()

    expect(result).toEqual({
      assets: [
        { name: 'asset.png', thumbnailUrl: '/api/view?filename=asset.png' }
      ],
      models: [
        { name: 'model.safetensors', thumbnailUrl: '/api/assets/model-thumb' }
      ]
    })
  })
})
