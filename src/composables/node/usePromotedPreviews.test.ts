import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { reactive } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import {
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { useNodeOutputStore } from '@/stores/imagePreviewStore'
import { usePromotionStore } from '@/stores/promotionStore'
import { createNodeLocatorId } from '@/types/nodeIdentification'

import { usePromotedPreviews } from './usePromotedPreviews'

vi.mock('@/stores/imagePreviewStore', () => {
  const nodeOutputs = reactive<Record<string, unknown>>({})
  const getNodeImageUrls = vi.fn()
  return {
    useNodeOutputStore: () => ({
      nodeOutputs,
      getNodeImageUrls
    })
  }
})

function createSetup() {
  const subgraph = createTestSubgraph()
  const subgraphNode = createTestSubgraphNode(subgraph)
  return { subgraph, subgraphNode }
}

function addInteriorNode(
  setup: ReturnType<typeof createSetup>,
  options: {
    id: number
    previewMediaType?: 'image' | 'video' | 'audio' | 'model'
  } = { id: 10 }
): LGraphNode {
  const node = new LGraphNode('test')
  node.id = options.id
  if (options.previewMediaType) {
    node.previewMediaType = options.previewMediaType
  }
  setup.subgraph.add(node)
  return node
}

function seedOutputs(subgraphId: string, nodeIds: Array<number | string>) {
  const store = useNodeOutputStore()
  for (const nodeId of nodeIds) {
    const locatorId = createNodeLocatorId(subgraphId, nodeId)
    store.nodeOutputs[locatorId] = {
      images: [{ filename: 'output.png' }]
    }
  }
}

describe('usePromotedPreviews', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.clearAllMocks()

    const store = useNodeOutputStore()
    for (const key of Object.keys(store.nodeOutputs)) {
      delete store.nodeOutputs[key]
    }
  })

  it('returns empty array for non-SubgraphNode', () => {
    const node = new LGraphNode('test')
    const { promotedPreviews } = usePromotedPreviews(() => node)
    expect(promotedPreviews.value).toEqual([])
  })

  it('returns empty array for null node', () => {
    const { promotedPreviews } = usePromotedPreviews(() => null)
    expect(promotedPreviews.value).toEqual([])
  })

  it('returns empty array when no $$ promotions exist', () => {
    const setup = createSetup()
    addInteriorNode(setup, { id: 10 })
    usePromotionStore().promote(setup.subgraphNode.id, '10', 'seed')

    const { promotedPreviews } = usePromotedPreviews(() => setup.subgraphNode)
    expect(promotedPreviews.value).toEqual([])
  })

  it('returns image preview for promoted $$ widget with outputs', () => {
    const setup = createSetup()
    addInteriorNode(setup, { id: 10, previewMediaType: 'image' })
    usePromotionStore().promote(
      setup.subgraphNode.id,
      '10',
      '$$canvas-image-preview'
    )

    const mockUrls = ['/view?filename=output.png']
    seedOutputs(setup.subgraph.id, [10])
    vi.mocked(useNodeOutputStore().getNodeImageUrls).mockReturnValue(mockUrls)

    const { promotedPreviews } = usePromotedPreviews(() => setup.subgraphNode)
    expect(promotedPreviews.value).toEqual([
      { interiorNodeId: '10', type: 'image', urls: mockUrls }
    ])
  })

  it('returns video type when interior node has video previewMediaType', () => {
    const setup = createSetup()
    addInteriorNode(setup, { id: 10, previewMediaType: 'video' })
    usePromotionStore().promote(
      setup.subgraphNode.id,
      '10',
      '$$canvas-image-preview'
    )

    seedOutputs(setup.subgraph.id, [10])
    vi.mocked(useNodeOutputStore().getNodeImageUrls).mockReturnValue([
      '/view?filename=output.webm'
    ])

    const { promotedPreviews } = usePromotedPreviews(() => setup.subgraphNode)
    expect(promotedPreviews.value[0].type).toBe('video')
  })

  it('returns separate entries for multiple promoted $$ widgets', () => {
    const setup = createSetup()
    const node10 = addInteriorNode(setup, {
      id: 10,
      previewMediaType: 'image'
    })
    const node20 = addInteriorNode(setup, {
      id: 20,
      previewMediaType: 'image'
    })
    usePromotionStore().promote(
      setup.subgraphNode.id,
      '10',
      '$$canvas-image-preview'
    )
    usePromotionStore().promote(
      setup.subgraphNode.id,
      '20',
      '$$canvas-image-preview'
    )

    seedOutputs(setup.subgraph.id, [10, 20])
    vi.mocked(useNodeOutputStore().getNodeImageUrls).mockImplementation(
      (node: LGraphNode) => {
        if (node === node10) return ['/view?a=1']
        if (node === node20) return ['/view?b=2']
        return undefined
      }
    )

    const { promotedPreviews } = usePromotedPreviews(() => setup.subgraphNode)
    expect(promotedPreviews.value).toHaveLength(2)
    expect(promotedPreviews.value[0].urls).toEqual(['/view?a=1'])
    expect(promotedPreviews.value[1].urls).toEqual(['/view?b=2'])
  })

  it('skips interior nodes with no image output', () => {
    const setup = createSetup()
    addInteriorNode(setup, { id: 10 })
    usePromotionStore().promote(
      setup.subgraphNode.id,
      '10',
      '$$canvas-image-preview'
    )

    const { promotedPreviews } = usePromotedPreviews(() => setup.subgraphNode)
    expect(promotedPreviews.value).toEqual([])
  })

  it('skips missing interior nodes', () => {
    const setup = createSetup()
    usePromotionStore().promote(
      setup.subgraphNode.id,
      '99',
      '$$canvas-image-preview'
    )

    const { promotedPreviews } = usePromotedPreviews(() => setup.subgraphNode)
    expect(promotedPreviews.value).toEqual([])
  })

  it('ignores non-$$ promoted widgets', () => {
    const setup = createSetup()
    addInteriorNode(setup, { id: 10 })
    usePromotionStore().promote(setup.subgraphNode.id, '10', 'seed')
    usePromotionStore().promote(
      setup.subgraphNode.id,
      '10',
      '$$canvas-image-preview'
    )

    const mockUrls = ['/view?filename=img.png']
    seedOutputs(setup.subgraph.id, [10])
    vi.mocked(useNodeOutputStore().getNodeImageUrls).mockReturnValue(mockUrls)

    const { promotedPreviews } = usePromotedPreviews(() => setup.subgraphNode)
    expect(promotedPreviews.value).toHaveLength(1)
    expect(promotedPreviews.value[0].urls).toEqual(mockUrls)
  })
})
