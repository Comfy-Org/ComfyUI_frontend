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

vi.mock('@/scripts/app', () => ({
  app: {
    get rootGraph() {
      return mockRootGraph
    }
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
    vi.restoreAllMocks()
    mockRootGraph.nodes = []
    mockAssetsByNodeType.clear()
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

  it('returns empty assets when graph has no asset nodes', () => {
    mockRootGraph.nodes = [
      createMockNode('KSampler', [{ name: 'seed', value: 42 }])
    ] as LGraphNode[]

    const service = useWorkflowShareService()
    expect(service.getWorkflowAssets()).toEqual([])
  })

  it('extracts assets from LoadImage nodes', () => {
    mockRootGraph.nodes = [
      createMockNode('LoadImage', [{ name: 'image', value: 'photo.png' }]),
      createMockNode('LoadAudio', [{ name: 'audio', value: 'clip.wav' }])
    ] as LGraphNode[]

    const service = useWorkflowShareService()
    const assets = service.getWorkflowAssets()

    expect(assets).toEqual([
      { name: 'photo.png', thumbnailUrl: null },
      { name: 'clip.wav', thumbnailUrl: null }
    ])
  })

  it('skips asset nodes with empty widget values', () => {
    mockRootGraph.nodes = [
      createMockNode('LoadImage', [{ name: 'image', value: '' }]),
      createMockNode('LoadImage', [{ name: 'image', value: 'real.png' }])
    ] as LGraphNode[]

    const service = useWorkflowShareService()
    expect(service.getWorkflowAssets()).toEqual([
      { name: 'real.png', thumbnailUrl: null }
    ])
  })

  it('returns empty models when graph has no model loaders', async () => {
    mockRootGraph.nodes = [
      createMockNode('LoadImage', [{ name: 'image', value: 'photo.png' }])
    ] as LGraphNode[]

    const service = useWorkflowShareService()
    expect(await service.getWorkflowModels()).toEqual([])
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

    const service = useWorkflowShareService()
    const models = await service.getWorkflowModels()

    expect(models).toEqual([
      { name: 'v1-5-pruned.safetensors' },
      { name: 'detail_tweaker.safetensors' }
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
      { name: 'public-model.safetensors', is_immutable: true }
    ])
    mockAssetsByNodeType.set('LoraLoader', [
      { name: 'my-lora.safetensors', is_immutable: false }
    ])

    const service = useWorkflowShareService()
    const models = await service.getWorkflowModels()

    expect(models).toEqual([{ name: 'my-lora.safetensors' }])
  })

  it('includes models not found in assets cache', async () => {
    mockRootGraph.nodes = [
      createMockNode('CheckpointLoaderSimple', [
        { name: 'ckpt_name', value: 'uncached-model.safetensors' }
      ])
    ] as LGraphNode[]

    const service = useWorkflowShareService()
    const models = await service.getWorkflowModels()

    expect(models).toEqual([{ name: 'uncached-model.safetensors' }])
  })
})
