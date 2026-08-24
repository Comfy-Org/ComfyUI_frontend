import { createTestingPinia } from '@pinia/testing'
import { fromPartial } from '@total-typescript/shoehorn'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { INodeOutputSlot } from '@/lib/litegraph/src/interfaces'
import type {
  LGraph,
  LGraphGroup,
  LGraphNode
} from '@/lib/litegraph/src/litegraph'
import { MinimapDataSource } from '@/renderer/extensions/minimap/data/MinimapDataSource'
import { useLinkStore } from '@/stores/linkStore'
import { toOwningGraphId, toRootGraphId } from '@/types/graphScopeId'
import { toLinkId } from '@/types/linkId'
import { createNodeLocatorId } from '@/types/nodeIdentification'
import { toNodeId } from '@/types/nodeId'
import {
  createMockLGraph,
  createMockLGraphNode
} from '@/utils/__tests__/litegraphTestUtils'

const useExecutionStore = vi.hoisted(() => vi.fn())

vi.mock('@/stores/executionStore', () => ({ useExecutionStore }))

const ROOT_GRAPH_ID = '00000000-0000-0000-0000-000000000001'
const SUBGRAPH_ID = '00000000-0000-0000-0000-000000000002'
const GRAPH_SCOPE = {
  rootGraphId: toRootGraphId(ROOT_GRAPH_ID),
  owningGraphId: toOwningGraphId(ROOT_GRAPH_ID)
}

function graphNode(
  id: string,
  pos: [number, number],
  outputs = 0,
  size: [number, number] = [100, 50],
  renderingSize = size
): LGraphNode {
  return createMockLGraphNode({
    id: toNodeId(id),
    pos,
    size,
    renderingSize,
    bgcolor: '#fff',
    has_errors: false,
    outputs: Array.from({ length: outputs }, () =>
      fromPartial<INodeOutputSlot>({})
    )
  })
}

function rootGraph(
  nodes: LGraphNode[] = [],
  groups: LGraphGroup[] = []
): LGraph {
  return createMockLGraph({
    id: ROOT_GRAPH_ID,
    isRootGraph: true,
    _nodes: nodes,
    _groups: groups
  })
}

describe('MinimapDataSource', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    useExecutionStore.mockReturnValue({ nodeLocationProgressStates: {} })
  })

  it('uses graph position and rendered size', () => {
    const source = new MinimapDataSource(
      rootGraph([graphNode('node1', [10, 20], 0, [100, 50], [240, 180])])
    )

    expect(source.getNodes()).toMatchObject([
      { id: toNodeId('node1'), x: 10, y: 20, width: 240, height: 180 }
    ])
  })

  it('uses graph-scoped execution state', () => {
    const node = graphNode('node1', [0, 0])
    const subgraph = createMockLGraph({
      id: SUBGRAPH_ID,
      isRootGraph: false,
      rootGraph: rootGraph(),
      _nodes: [node]
    })
    useExecutionStore.mockReturnValue({
      nodeLocationProgressStates: {
        [createNodeLocatorId(SUBGRAPH_ID, node.id)]: { state: 'running' }
      }
    })

    expect(new MinimapDataSource(subgraph).getNodes()).toMatchObject([
      { executionState: 'running' }
    ])
  })

  it('handles an empty graph', () => {
    const source = new MinimapDataSource(rootGraph())

    expect(source.hasData()).toBe(false)
    expect(source.getNodeCount()).toBe(0)
    expect(source.getNodes()).toEqual([])
    expect(source.getLinks()).toEqual([])
    expect(source.getGroups()).toEqual([])
  })

  it('uses graph group geometry', () => {
    const group = fromPartial<LGraphGroup>({
      pos: [40, 60],
      size: [300, 200],
      color: '#abcdef'
    })

    expect(new MinimapDataSource(rootGraph([], [group])).getGroups()).toEqual([
      { x: 40, y: 60, width: 300, height: 200, color: '#abcdef' }
    ])
  })

  it('derives links between nodes in the active graph', () => {
    useLinkStore().registerLink(GRAPH_SCOPE, {
      id: toLinkId(1),
      graphId: GRAPH_SCOPE.owningGraphId,
      originNodeId: toNodeId('node1'),
      originSlot: 0,
      targetNodeId: toNodeId('node2'),
      targetSlot: 1,
      type: 'INT'
    })
    const source = new MinimapDataSource(
      rootGraph([graphNode('node1', [0, 0], 1), graphNode('node2', [0, 0])])
    )

    expect(source.getLinks()).toMatchObject([
      {
        sourceNode: { id: toNodeId('node1') },
        targetNode: { id: toNodeId('node2') },
        sourceSlot: 0,
        targetSlot: 1
      }
    ])
  })

  it('omits links to nodes outside the active graph', () => {
    useLinkStore().registerLink(GRAPH_SCOPE, {
      id: toLinkId(1),
      graphId: GRAPH_SCOPE.owningGraphId,
      originNodeId: toNodeId('node1'),
      originSlot: 0,
      targetNodeId: toNodeId('elsewhere'),
      targetSlot: 0,
      type: 'INT'
    })

    expect(
      new MinimapDataSource(
        rootGraph([graphNode('node1', [0, 0], 1)])
      ).getLinks()
    ).toEqual([])
  })

  it('calculates bounds from rendered node geometry', () => {
    const source = new MinimapDataSource(
      rootGraph([
        graphNode('node1', [0, 0]),
        graphNode('node2', [200, 100], 0, [100, 50], [150, 75])
      ])
    )

    expect(source.getBounds()).toEqual({
      minX: 0,
      minY: 0,
      maxX: 350,
      maxY: 175,
      width: 350,
      height: 175
    })
  })
})
