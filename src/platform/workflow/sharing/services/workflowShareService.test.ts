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

vi.mock('@/scripts/api', () => ({
  api: {
    getShareableAssets: (...args: unknown[]) => mockGetShareableAssets(...args),
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
    updateModelsForNodeType: vi.fn()
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
  beforeEach(() => {
    vi.resetAllMocks()
    mockRootGraph.nodes = []
    mockAssetsByNodeType.clear()
    mockInputAssets.splice(0)
    mockUpdateInputs.mockReset()
    mockApp.rootGraph = mockRootGraph
  })

  it('returns unpublished status for unknown workflow', () => {
    const service = useWorkflowShareService()
    const status = service.getPublishStatus('unknown-id', 1000)

    expect(status.isPublished).toBe(false)
    expect(status.shareUrl).toBeNull()
    expect(status.publishedAt).toBeNull()
    expect(status.hasChangesSincePublish).toBe(false)
  })

  it('publishes a workflow and returns a share URL', async () => {
    vi.useFakeTimers()
    const service = useWorkflowShareService()

    const publishPromise = service.publishWorkflow('test-workflow', 1000)
    await vi.advanceTimersByTimeAsync(800)
    const result = await publishPromise

    expect(result.shareUrl).toContain('test-workflow')
    expect(result.publishedAt).toBeInstanceOf(Date)

    vi.useRealTimers()
  })

  it('reports published status after publishing', async () => {
    vi.useFakeTimers()
    const service = useWorkflowShareService()

    const savedAt = 1000
    const publishPromise = service.publishWorkflow('wf-1', savedAt)
    await vi.advanceTimersByTimeAsync(800)
    await publishPromise

    const status = service.getPublishStatus('wf-1', savedAt)
    expect(status.isPublished).toBe(true)
    expect(status.shareUrl).toBeTruthy()
    expect(status.publishedAt).toBeInstanceOf(Date)
    expect(status.hasChangesSincePublish).toBe(false)

    vi.useRealTimers()
  })

  it('detects changes when workflow was saved after publish', async () => {
    vi.useFakeTimers()
    const service = useWorkflowShareService()

    const savedAtPublish = 1000
    const publishPromise = service.publishWorkflow('wf-2', savedAtPublish)
    await vi.advanceTimersByTimeAsync(800)
    await publishPromise

    const savedAfterEdit = 2000
    const status = service.getPublishStatus('wf-2', savedAfterEdit)
    expect(status.hasChangesSincePublish).toBe(true)

    vi.useRealTimers()
  })

  it('reports no changes when workflow has not been saved since publish', async () => {
    vi.useFakeTimers()
    const service = useWorkflowShareService()

    const savedAt = 1000
    const publishPromise = service.publishWorkflow('wf-3', savedAt)
    await vi.advanceTimersByTimeAsync(800)
    await publishPromise

    const status = service.getPublishStatus('wf-3', savedAt)
    expect(status.hasChangesSincePublish).toBe(false)

    vi.useRealTimers()
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
