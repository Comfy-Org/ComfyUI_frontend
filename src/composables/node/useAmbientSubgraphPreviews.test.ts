import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { reactive } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import {
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import { createNodeLocatorId } from '@/types/nodeIdentification'
import { toNodeId } from '@/types/nodeId'

import { useAmbientSubgraphPreviews } from './useAmbientSubgraphPreviews'

type MockNodeOutputStore = Pick<
  ReturnType<typeof useNodeOutputStore>,
  | 'nodeOutputs'
  | 'nodePreviewImages'
  | 'getNodeImageUrls'
  | 'isInputPreviewOutput'
>

vi.mock('@/stores/nodeOutputStore', () => {
  const store: MockNodeOutputStore = {
    nodeOutputs: reactive<MockNodeOutputStore['nodeOutputs']>({}),
    nodePreviewImages: reactive<MockNodeOutputStore['nodePreviewImages']>({}),
    getNodeImageUrls: vi.fn(),
    isInputPreviewOutput: (output) => {
      const images = (output as { images?: { type?: string }[] } | undefined)
        ?.images
      return (
        Array.isArray(images) &&
        images.length > 0 &&
        images.every((i) => i?.type === 'input')
      )
    }
  }
  return { useNodeOutputStore: () => store }
})

function clearMockNodeOutputStore() {
  const { nodeOutputs, nodePreviewImages } = useNodeOutputStore()
  for (const key of Object.keys(nodeOutputs)) delete nodeOutputs[key]
  for (const key of Object.keys(nodePreviewImages))
    delete nodePreviewImages[key]
}

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
  }
): LGraphNode {
  const node = new LGraphNode('test')
  node.id = toNodeId(options.id)
  if (options.previewMediaType) {
    node.previewMediaType = options.previewMediaType
  }
  setup.subgraph.add(node)
  return node
}

function seedOutputs(subgraphId: string, nodeIds: Array<number | string>) {
  const store = useNodeOutputStore()
  for (const nodeId of nodeIds) {
    const locatorId = createNodeLocatorId(subgraphId, toNodeId(nodeId))
    store.nodeOutputs[locatorId] = {
      images: [{ filename: 'output.png' }]
    }
  }
}

describe(useAmbientSubgraphPreviews, () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.resetAllMocks()
    clearMockNodeOutputStore()
  })

  it('returns empty array for non-SubgraphNode', () => {
    const node = new LGraphNode('test')
    const { ambientPreviews } = useAmbientSubgraphPreviews(() => node)
    expect(ambientPreviews.value).toEqual([])
  })

  it('returns empty array for null node', () => {
    const { ambientPreviews } = useAmbientSubgraphPreviews(() => null)
    expect(ambientPreviews.value).toEqual([])
  })

  it('returns empty array (does not throw) when SubgraphNode is detached', () => {
    const setup = createSetup()
    const parentGraph = setup.subgraphNode.graph!
    parentGraph.add(setup.subgraphNode)
    parentGraph.remove(setup.subgraphNode)

    expect(setup.subgraphNode.graph).toBeNull()
    const { ambientPreviews } = useAmbientSubgraphPreviews(
      () => setup.subgraphNode
    )
    expect(() => ambientPreviews.value).not.toThrow()
    expect(ambientPreviews.value).toEqual([])
  })

  it('returns empty array when no interior node has produced output', () => {
    const setup = createSetup()
    addInteriorNode(setup, { id: 10 })

    const { ambientPreviews } = useAmbientSubgraphPreviews(
      () => setup.subgraphNode
    )
    expect(ambientPreviews.value).toEqual([])
  })

  it('returns a preview for an interior node with live output, without any exposure', () => {
    const setup = createSetup()
    const node = addInteriorNode(setup, { id: 10, previewMediaType: 'image' })
    seedOutputs(setup.subgraph.id, [10])
    const urls = ['/view?filename=output.png']
    vi.mocked(useNodeOutputStore().getNodeImageUrls).mockImplementation((n) =>
      n === node ? urls : undefined
    )

    const { ambientPreviews } = useAmbientSubgraphPreviews(
      () => setup.subgraphNode
    )
    expect(ambientPreviews.value).toEqual([
      expect.objectContaining({
        sourceNodeId: '10',
        type: 'image',
        urls
      })
    ])
  })

  // Regression case for incident-94 bug #3: 2 KSamplers producing live
  // previews concurrently in one subgraph must both surface, not just one.
  it('returns separate entries for two concurrently-executing interior nodes', () => {
    const setup = createSetup()
    const node10 = addInteriorNode(setup, {
      id: 10,
      previewMediaType: 'image'
    })
    const node20 = addInteriorNode(setup, {
      id: 20,
      previewMediaType: 'image'
    })
    seedOutputs(setup.subgraph.id, [10, 20])
    vi.mocked(useNodeOutputStore().getNodeImageUrls).mockImplementation(
      (node) => {
        if (node === node10) return ['/view?a=1']
        if (node === node20) return ['/view?b=2']
        return undefined
      }
    )

    const { ambientPreviews } = useAmbientSubgraphPreviews(
      () => setup.subgraphNode
    )
    expect(ambientPreviews.value).toHaveLength(2)
    const urlsBySourceNodeId = new Map(
      ambientPreviews.value.map((p) => [p.sourceNodeId, p.urls])
    )
    expect(urlsBySourceNodeId.get(toNodeId(10))).toEqual(['/view?a=1'])
    expect(urlsBySourceNodeId.get(toNodeId(20))).toEqual(['/view?b=2'])
  })

  it('skips interior nodes with no image output', () => {
    const setup = createSetup()
    addInteriorNode(setup, { id: 10 })

    const { ambientPreviews } = useAmbientSubgraphPreviews(
      () => setup.subgraphNode
    )
    expect(ambientPreviews.value).toEqual([])
  })

  // Regression case: an unpromoted LoadImage-style node's own selected file
  // is an "input" preview, not a live execution result. Surfacing it
  // ambiently would make every such node's thumbnail always visible on the
  // host regardless of promotion, breaking exclusivity of the promotion UI.
  it('skips interior nodes whose only output is an input-type preview (e.g. LoadImage)', () => {
    const setup = createSetup()
    const node = addInteriorNode(setup, { id: 10, previewMediaType: 'image' })
    const store = useNodeOutputStore()
    const locatorId = createNodeLocatorId(setup.subgraph.id, toNodeId(10))!
    store.nodeOutputs[locatorId] = {
      images: [{ filename: 'input.png', type: 'input' }]
    }
    vi.mocked(store.getNodeImageUrls).mockImplementation((n) =>
      n === node ? ['/view?filename=input.png'] : undefined
    )

    const { ambientPreviews } = useAmbientSubgraphPreviews(
      () => setup.subgraphNode
    )
    expect(ambientPreviews.value).toEqual([])
  })

  it('recomputes when outputs are populated after first evaluation', () => {
    const setup = createSetup()
    const node = addInteriorNode(setup, { id: 10, previewMediaType: 'image' })

    const { ambientPreviews } = useAmbientSubgraphPreviews(
      () => setup.subgraphNode
    )
    expect(ambientPreviews.value).toEqual([])

    seedOutputs(setup.subgraph.id, [10])
    const urls = ['/view?filename=output.png']
    vi.mocked(useNodeOutputStore().getNodeImageUrls).mockImplementation((n) =>
      n === node ? urls : undefined
    )

    expect(ambientPreviews.value).toEqual([
      expect.objectContaining({ sourceNodeId: '10', urls })
    ])
  })

  it('skips nested SubgraphNode interior nodes (they derive their own previews)', () => {
    const setup = createSetup()
    const nestedSubgraph = createTestSubgraph()
    const nestedHost = createTestSubgraphNode(nestedSubgraph, { id: 30 })
    setup.subgraph.add(nestedHost)
    seedOutputs(setup.subgraph.id, [30])

    const { ambientPreviews } = useAmbientSubgraphPreviews(
      () => setup.subgraphNode
    )
    expect(ambientPreviews.value).toEqual([])
  })
})
