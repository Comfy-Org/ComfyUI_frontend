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
import { toNodeId } from '@/types/nodeId'

import { getPreviewMediaType } from './usePromotedPreviews'
import { useAmbientSubgraphPreviews } from './useAmbientSubgraphPreviews'

type MockNodeOutputStore = Pick<
  ReturnType<typeof useNodeOutputStore>,
  | 'nodeOutputs'
  | 'nodePreviewImages'
  | 'getNodeImageUrls'
  | 'getNodePreviewImagesByExecutionId'
  | 'getNodeImageUrlsByExecutionId'
>

vi.mock('@/stores/nodeOutputStore', () => {
  // Reused (keyed by `NodeExecutionId` strings, not `NodeLocatorId`s) as the
  // backing store for `getNodePreviewImagesByExecutionId` below, so seeding
  // it stays a plain reactive write — see "Mocking Composables with Reactive
  // State" in docs/testing/unit-testing.md.
  const nodePreviewImages = reactive<MockNodeOutputStore['nodePreviewImages']>(
    {}
  )
  const store: MockNodeOutputStore = {
    nodeOutputs: reactive<MockNodeOutputStore['nodeOutputs']>({}),
    nodePreviewImages,
    getNodeImageUrls: vi.fn(),
    getNodePreviewImagesByExecutionId: vi.fn(
      (executionId: string) => nodePreviewImages[executionId]
    ),
    getNodeImageUrlsByExecutionId: vi.fn()
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

/**
 * Seeds a live preview frame for an interior node, keyed the same way
 * production writes it: `<host id>:<interior node id>`.
 */
function seedOutputs(hostId: number | string, nodeIds: Array<number | string>) {
  const { nodePreviewImages } = useNodeOutputStore()
  for (const nodeId of nodeIds) {
    nodePreviewImages[`${hostId}:${nodeId}`] = ['seeded-preview-url']
  }
}

describe(useAmbientSubgraphPreviews, () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
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
    addInteriorNode(setup, { id: 10, previewMediaType: 'image' })
    seedOutputs(setup.subgraphNode.id, [10])
    vi.mocked(
      useNodeOutputStore().getNodeImageUrlsByExecutionId
    ).mockReturnValue(['/view?filename=output.png'])

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
    seedOutputs(setup.subgraphNode.id, [10])
    const urls = ['/view?filename=output.png']
    const executionId = `${setup.subgraphNode.id}:10`
    vi.mocked(
      useNodeOutputStore().getNodeImageUrlsByExecutionId
    ).mockImplementation((id) => (id === executionId ? urls : undefined))

    const { ambientPreviews } = useAmbientSubgraphPreviews(
      () => setup.subgraphNode
    )
    expect(ambientPreviews.value).toEqual([
      expect.objectContaining({
        sourceNodeId: '10',
        type: getPreviewMediaType(node),
        urls
      })
    ])
  })

  it.for([
    ['video', '/view?filename=output.webm'],
    ['audio', '/view?filename=output.mp3']
  ] as const)(
    'derives %s type from previewMediaType, same as the promoted path',
    ([mediaType, url]) => {
      const setup = createSetup()
      addInteriorNode(setup, {
        id: 10,
        previewMediaType: mediaType
      })
      seedOutputs(setup.subgraphNode.id, [10])
      const executionId = `${setup.subgraphNode.id}:10`
      vi.mocked(
        useNodeOutputStore().getNodeImageUrlsByExecutionId
      ).mockImplementation((id) => (id === executionId ? [url] : undefined))

      const { ambientPreviews } = useAmbientSubgraphPreviews(
        () => setup.subgraphNode
      )
      expect(ambientPreviews.value).toEqual([
        expect.objectContaining({ sourceNodeId: '10', type: mediaType })
      ])
    }
  )

  it('returns separate entries for two concurrently-executing interior nodes', () => {
    const setup = createSetup()
    addInteriorNode(setup, {
      id: 10,
      previewMediaType: 'image'
    })
    addInteriorNode(setup, {
      id: 20,
      previewMediaType: 'image'
    })
    seedOutputs(setup.subgraphNode.id, [10, 20])
    const hostId = setup.subgraphNode.id
    vi.mocked(
      useNodeOutputStore().getNodeImageUrlsByExecutionId
    ).mockImplementation((executionId) => {
      if (executionId === `${hostId}:10`) return ['/view?a=1']
      if (executionId === `${hostId}:20`) return ['/view?b=2']
      return undefined
    })

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

  it('skips interior nodes when getNodeImageUrlsByExecutionId returns no urls despite a preview entry', () => {
    const setup = createSetup()
    addInteriorNode(setup, { id: 10, previewMediaType: 'image' })
    seedOutputs(setup.subgraphNode.id, [10])
    vi.mocked(
      useNodeOutputStore().getNodeImageUrlsByExecutionId
    ).mockReturnValue(undefined)

    const { ambientPreviews } = useAmbientSubgraphPreviews(
      () => setup.subgraphNode
    )
    expect(ambientPreviews.value).toEqual([])
  })

  // Regression coverage for narrowing the gate to a live streaming preview
  // frame only: a committed output must never surface ambiently, even when
  // an image url is otherwise resolvable — otherwise demoting an exposure
  // becomes a no-op and every interior output node stacks a permanent
  // preview on the host after every run.
  it('does not surface a committed output that was never a streaming preview', () => {
    const setup = createSetup()
    addInteriorNode(setup, { id: 10, previewMediaType: 'image' })
    vi.mocked(
      useNodeOutputStore().getNodeImageUrlsByExecutionId
    ).mockReturnValue(['/view?filename=output.png'])

    const { ambientPreviews } = useAmbientSubgraphPreviews(
      () => setup.subgraphNode
    )
    expect(ambientPreviews.value).toEqual([])
  })

  it('recomputes when outputs are populated after first evaluation', () => {
    const setup = createSetup()
    addInteriorNode(setup, { id: 10, previewMediaType: 'image' })

    const { ambientPreviews } = useAmbientSubgraphPreviews(
      () => setup.subgraphNode
    )
    expect(ambientPreviews.value).toEqual([])

    seedOutputs(setup.subgraphNode.id, [10])
    const urls = ['/view?filename=output.png']
    const executionId = `${setup.subgraphNode.id}:10`
    vi.mocked(
      useNodeOutputStore().getNodeImageUrlsByExecutionId
    ).mockImplementation((id) => (id === executionId ? urls : undefined))

    expect(ambientPreviews.value).toEqual([
      expect.objectContaining({ sourceNodeId: '10', urls })
    ])
  })

  it('self-heals once an interior node added after the first evaluation gets its first preview frame', () => {
    const setup = createSetup()

    const { ambientPreviews } = useAmbientSubgraphPreviews(
      () => setup.subgraphNode
    )
    expect(ambientPreviews.value).toEqual([])

    addInteriorNode(setup, { id: 10, previewMediaType: 'image' })
    seedOutputs(setup.subgraphNode.id, [10])
    const urls = ['/view?filename=output.png']
    const executionId = `${setup.subgraphNode.id}:10`
    vi.mocked(
      useNodeOutputStore().getNodeImageUrlsByExecutionId
    ).mockImplementation((id) => (id === executionId ? urls : undefined))

    expect(ambientPreviews.value).toEqual([
      expect.objectContaining({ sourceNodeId: '10', urls })
    ])
  })

  it('skips nested SubgraphNode interior nodes (they derive their own previews)', () => {
    const setup = createSetup()
    const nestedSubgraph = createTestSubgraph()
    const nestedHost = createTestSubgraphNode(nestedSubgraph, { id: 30 })
    setup.subgraph.add(nestedHost)
    seedOutputs(setup.subgraphNode.id, [30])
    vi.mocked(
      useNodeOutputStore().getNodeImageUrlsByExecutionId
    ).mockReturnValue(['/view?filename=output.png'])

    const { ambientPreviews } = useAmbientSubgraphPreviews(
      () => setup.subgraphNode
    )
    expect(ambientPreviews.value).toEqual([])
  })

  it('skips interior nodes with hideOutputImages set', () => {
    const setup = createSetup()
    const node = addInteriorNode(setup, { id: 10, previewMediaType: 'image' })
    node.hideOutputImages = true
    seedOutputs(setup.subgraphNode.id, [10])
    vi.mocked(
      useNodeOutputStore().getNodeImageUrlsByExecutionId
    ).mockReturnValue(['/view?filename=output.png'])

    const { ambientPreviews } = useAmbientSubgraphPreviews(
      () => setup.subgraphNode
    )
    expect(ambientPreviews.value).toEqual([])
  })
})
