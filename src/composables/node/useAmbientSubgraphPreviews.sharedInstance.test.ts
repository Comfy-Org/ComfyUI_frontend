import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraphNode as LGraphNodeType } from '@/lib/litegraph/src/litegraph'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import {
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { app } from '@/scripts/app'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import { toNodeId } from '@/types/nodeId'
import {
  createNodeExecutionId,
  createNodeLocatorId
} from '@/types/nodeIdentification'
import { isSubgraph } from '@/utils/typeGuardUtil'

import { useAmbientSubgraphPreviews } from './useAmbientSubgraphPreviews'

// Deliberately left unmocked: `@/utils/graphTraversalUtil`. The whole point
// of this regression is exercising the real `executionIdToNodeLocatorId`
// collapse — two instances of the same subgraph definition resolve to the
// same `NodeLocatorId` — rather than a mock that pretends instances stay
// distinct at the storage layer.
vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: vi.fn(() => ({
    nodeIdToNodeLocatorId: vi.fn((id: string | number) =>
      createNodeLocatorId(null, toNodeId(id))
    ),
    nodeToNodeLocatorId: vi.fn((node: LGraphNodeType) =>
      isSubgraph(node.graph)
        ? createNodeLocatorId(node.graph.id, node.id)
        : createNodeLocatorId(null, node.id)
    )
  }))
}))

describe('useAmbientSubgraphPreviews with a shared subgraph definition', () => {
  beforeEach(() => {
    app.nodeOutputs = {}
    app.nodePreviewImages = {}
  })

  it('keeps each host instance showing only its own live preview frame', () => {
    const subgraph = createTestSubgraph()
    const interiorNode = new LGraphNode('test')
    interiorNode.id = toNodeId(10)
    interiorNode.previewMediaType = 'image'
    subgraph.add(interiorNode)

    const rootGraph = subgraph.rootGraph
    const firstHost = createTestSubgraphNode(subgraph, { id: 11 })
    const secondHost = createTestSubgraphNode(subgraph, { id: 12 })
    rootGraph.add(firstHost)
    rootGraph.add(secondHost)

    vi.spyOn(app, 'rootGraph', 'get').mockReturnValue(rootGraph)

    const nodeOutputStore = useNodeOutputStore()
    nodeOutputStore.setNodePreviewsByExecutionId(
      createNodeExecutionId([toNodeId(11), toNodeId(10)]),
      ['blob:first']
    )
    nodeOutputStore.setNodePreviewsByExecutionId(
      createNodeExecutionId([toNodeId(12), toNodeId(10)]),
      ['blob:second']
    )

    const firstHostPreviews = useAmbientSubgraphPreviews(
      () => firstHost
    ).ambientPreviews
    const secondHostPreviews = useAmbientSubgraphPreviews(
      () => secondHost
    ).ambientPreviews

    expect(firstHostPreviews.value).toEqual([
      expect.objectContaining({
        sourceNodeId: toNodeId(10),
        urls: ['blob:first']
      })
    ])
    expect(secondHostPreviews.value).toEqual([
      expect.objectContaining({
        sourceNodeId: toNodeId(10),
        urls: ['blob:second']
      })
    ])
  })
})

describe('useAmbientSubgraphPreviews for a host nested inside another subgraph', () => {
  beforeEach(() => {
    app.nodeOutputs = {}
    app.nodePreviewImages = {}
  })

  it('surfaces a live preview for its own interior node', () => {
    const innerSubgraph = createTestSubgraph()
    const interiorSampler = new LGraphNode('test')
    interiorSampler.id = toNodeId(11)
    interiorSampler.previewMediaType = 'image'
    innerSubgraph.add(interiorSampler)

    const outerSubgraph = createTestSubgraph()
    const innerHost = createTestSubgraphNode(innerSubgraph, { id: 10 })
    outerSubgraph.add(innerHost)

    const rootGraph = outerSubgraph.rootGraph
    const outerHost = createTestSubgraphNode(outerSubgraph, { id: 9 })
    rootGraph.add(outerHost)

    vi.spyOn(app, 'rootGraph', 'get').mockReturnValue(rootGraph)

    const nodeOutputStore = useNodeOutputStore()
    // Mirrors production ancestor fan-out (`app.ts`'s `b_preview_with_metadata`
    // handler), which writes the frame at every prefix of the full path.
    for (const executionId of [
      createNodeExecutionId([toNodeId(9)]),
      createNodeExecutionId([toNodeId(9), toNodeId(10)]),
      createNodeExecutionId([toNodeId(9), toNodeId(10), toNodeId(11)])
    ]) {
      nodeOutputStore.setNodePreviewsByExecutionId(executionId, ['blob:nested'])
    }

    const { ambientPreviews } = useAmbientSubgraphPreviews(() => innerHost)

    expect(ambientPreviews.value).toEqual([
      expect.objectContaining({
        sourceNodeId: toNodeId(11),
        urls: ['blob:nested']
      })
    ])
  })
})
