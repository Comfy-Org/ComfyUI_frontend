import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import { useNodeOutputStore } from '@/stores/imagePreviewStore'
import { usePromotionStore } from '@/stores/promotionStore'

import { usePromotedPreviews } from './usePromotedPreviews'

vi.mock('@/stores/imagePreviewStore', () => ({
  useNodeOutputStore: vi.fn()
}))

const MOCK_SUBGRAPH_UUID = 'test-subgraph-uuid'

function createMockSubgraphNode(
  id: number,
  interiorNodes: Record<string, Partial<LGraphNode>>
): SubgraphNode {
  const node = {
    id,
    subgraph: {
      id: MOCK_SUBGRAPH_UUID,
      getNodeById(nodeId: string) {
        return interiorNodes[nodeId] ?? null
      }
    }
  }
  Object.setPrototypeOf(node, SubgraphNode.prototype)
  return node as unknown as SubgraphNode
}

function createMockNodeOutputStore(
  interiorNodeIds: string[],
  getNodeImageUrls: ReturnType<typeof vi.fn>
) {
  const nodeOutputs: Record<string, { images: { filename: string }[] }> = {}
  for (const nodeId of interiorNodeIds) {
    const locatorId = `${MOCK_SUBGRAPH_UUID}:${nodeId}`
    nodeOutputs[locatorId] = { images: [{ filename: 'output.png' }] }
  }
  return {
    nodeOutputs,
    getNodeImageUrls
  } as unknown as ReturnType<typeof useNodeOutputStore>
}

describe('usePromotedPreviews', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.clearAllMocks()
  })

  it('returns empty array for non-SubgraphNode', () => {
    const node = { id: 1 } as LGraphNode
    vi.mocked(useNodeOutputStore).mockReturnValue({
      getNodeImageUrls: vi.fn()
    } as unknown as ReturnType<typeof useNodeOutputStore>)

    const { promotedPreviews } = usePromotedPreviews(() => node)
    expect(promotedPreviews.value).toEqual([])
  })

  it('returns empty array for null node', () => {
    vi.mocked(useNodeOutputStore).mockReturnValue({
      getNodeImageUrls: vi.fn()
    } as unknown as ReturnType<typeof useNodeOutputStore>)

    const { promotedPreviews } = usePromotedPreviews(() => null)
    expect(promotedPreviews.value).toEqual([])
  })

  it('returns empty array when no $$ promotions exist', () => {
    const subgraphNode = createMockSubgraphNode(5, {})

    const promotionStore = usePromotionStore()
    promotionStore.promote(5, '10', 'seed')

    vi.mocked(useNodeOutputStore).mockReturnValue({
      getNodeImageUrls: vi.fn()
    } as unknown as ReturnType<typeof useNodeOutputStore>)

    const { promotedPreviews } = usePromotedPreviews(() => subgraphNode)
    expect(promotedPreviews.value).toEqual([])
  })

  it('returns image preview for promoted $$ widget with outputs', () => {
    const interiorNode = {
      id: 10,
      previewMediaType: 'image'
    } as Partial<LGraphNode>

    const subgraphNode = createMockSubgraphNode(5, { '10': interiorNode })

    const promotionStore = usePromotionStore()
    promotionStore.promote(5, '10', '$$canvas-image-preview')

    const mockUrls = ['/view?filename=output.png']
    vi.mocked(useNodeOutputStore).mockReturnValue(
      createMockNodeOutputStore(['10'], vi.fn().mockReturnValue(mockUrls))
    )

    const { promotedPreviews } = usePromotedPreviews(() => subgraphNode)
    expect(promotedPreviews.value).toEqual([
      { interiorNodeId: '10', type: 'image', urls: mockUrls }
    ])
  })

  it('returns video type when interior node has video previewMediaType', () => {
    const interiorNode = {
      id: 10,
      previewMediaType: 'video'
    } as Partial<LGraphNode>

    const subgraphNode = createMockSubgraphNode(5, { '10': interiorNode })

    const promotionStore = usePromotionStore()
    promotionStore.promote(5, '10', '$$canvas-image-preview')

    vi.mocked(useNodeOutputStore).mockReturnValue(
      createMockNodeOutputStore(
        ['10'],
        vi.fn().mockReturnValue(['/view?filename=output.webm'])
      )
    )

    const { promotedPreviews } = usePromotedPreviews(() => subgraphNode)
    expect(promotedPreviews.value[0].type).toBe('video')
  })

  it('returns separate entries for multiple promoted $$ widgets', () => {
    const node10 = { id: 10, previewMediaType: 'image' } as Partial<LGraphNode>
    const node20 = { id: 20, previewMediaType: 'image' } as Partial<LGraphNode>

    const subgraphNode = createMockSubgraphNode(5, {
      '10': node10,
      '20': node20
    })

    const promotionStore = usePromotionStore()
    promotionStore.promote(5, '10', '$$canvas-image-preview')
    promotionStore.promote(5, '20', '$$canvas-image-preview')

    const getNodeImageUrls = vi.fn((node: LGraphNode) => {
      if (node.id === 10) return ['/view?a=1']
      if (node.id === 20) return ['/view?b=2']
      return undefined
    })

    vi.mocked(useNodeOutputStore).mockReturnValue(
      createMockNodeOutputStore(['10', '20'], getNodeImageUrls)
    )

    const { promotedPreviews } = usePromotedPreviews(() => subgraphNode)
    expect(promotedPreviews.value).toHaveLength(2)
    expect(promotedPreviews.value[0].urls).toEqual(['/view?a=1'])
    expect(promotedPreviews.value[1].urls).toEqual(['/view?b=2'])
  })

  it('skips interior nodes with no image output', () => {
    const interiorNode = { id: 10 } as Partial<LGraphNode>
    const subgraphNode = createMockSubgraphNode(5, { '10': interiorNode })

    const promotionStore = usePromotionStore()
    promotionStore.promote(5, '10', '$$canvas-image-preview')

    vi.mocked(useNodeOutputStore).mockReturnValue({
      nodeOutputs: {},
      getNodeImageUrls: vi.fn().mockReturnValue(undefined)
    } as unknown as ReturnType<typeof useNodeOutputStore>)

    const { promotedPreviews } = usePromotedPreviews(() => subgraphNode)
    expect(promotedPreviews.value).toEqual([])
  })

  it('skips missing interior nodes', () => {
    const subgraphNode = createMockSubgraphNode(5, {})

    const promotionStore = usePromotionStore()
    promotionStore.promote(5, '99', '$$canvas-image-preview')

    vi.mocked(useNodeOutputStore).mockReturnValue({
      getNodeImageUrls: vi.fn()
    } as unknown as ReturnType<typeof useNodeOutputStore>)

    const { promotedPreviews } = usePromotedPreviews(() => subgraphNode)
    expect(promotedPreviews.value).toEqual([])
  })

  it('ignores non-$$ promoted widgets', () => {
    const interiorNode = { id: 10 } as Partial<LGraphNode>
    const subgraphNode = createMockSubgraphNode(5, { '10': interiorNode })

    const promotionStore = usePromotionStore()
    promotionStore.promote(5, '10', 'seed')
    promotionStore.promote(5, '10', '$$canvas-image-preview')

    const mockUrls = ['/view?filename=img.png']
    vi.mocked(useNodeOutputStore).mockReturnValue(
      createMockNodeOutputStore(['10'], vi.fn().mockReturnValue(mockUrls))
    )

    const { promotedPreviews } = usePromotedPreviews(() => subgraphNode)
    expect(promotedPreviews.value).toHaveLength(1)
    expect(promotedPreviews.value[0].urls).toEqual(mockUrls)
  })
})
