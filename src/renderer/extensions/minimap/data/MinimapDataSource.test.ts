import { toGroupId } from '@/types/groupId'
import { createTestingPinia } from '@pinia/testing'
import { fromPartial } from '@total-typescript/shoehorn'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { INodeOutputSlot } from '@/lib/litegraph/src/interfaces'
import type {
  LGraph,
  LGraphGroup,
  LGraphNode
} from '@/lib/litegraph/src/litegraph'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import {
  createMockLGraph,
  createMockLGraphNode,
  createNodeState
} from '@/utils/__tests__/litegraphTestUtils'
import type { GroupLayout, NodeLayout } from '@/renderer/core/layout/types'
import { MinimapDataSourceFactory } from '@/renderer/extensions/minimap/data/MinimapDataSourceFactory'
import { useLinkStore } from '@/stores/linkStore'
import { useNodeDataStore } from '@/stores/nodeDataStore'
import { toLinkId } from '@/types/linkId'
import { toNodeId } from '@/types/nodeId'
import type { NodeId } from '@/types/nodeId'
import type { UUID } from '@/utils/uuid'

const layouts = vi.hoisted(() => new Map<string, NodeLayout>())
const groupLayouts = vi.hoisted(() => new Map<number, GroupLayout>())
const getAllGroups = vi.hoisted(() =>
  vi.fn(() => ({
    get value() {
      return groupLayouts
    }
  }))
)

vi.mock('@/renderer/core/layout/store/layoutStore', () => ({
  layoutStore: {
    getNodeLayoutRef: vi.fn((_rootGraphId: UUID, nodeId: NodeId) => ({
      get value() {
        return layouts.get(String(nodeId)) ?? null
      }
    })),
    getAllGroups
  }
}))

vi.mock('@/stores/executionStore', () => ({
  useExecutionStore: vi.fn().mockReturnValue({
    nodeProgressStates: {},
    nodeLocationProgressStates: {}
  })
}))

const GRAPH_ID: UUID = 'minimap-graph'

function createMockGraph(
  nodes: LGraphNode[] = [],
  groups: LGraphGroup[] = []
): LGraph {
  return createMockLGraph({ id: GRAPH_ID, _nodes: nodes, _groups: groups })
}

/** Adds a node to `nodeDataStore`, which is how the layout source scopes. */
function registerNodeState(id: string, graphId: UUID = GRAPH_ID) {
  useNodeDataStore().registerNode(
    GRAPH_ID,
    createNodeState({
      id: toNodeId(id),
      graphId,
      title: id,
      bgcolor: '#123456'
    })
  )
}

function setLayout(id: string, x: number, y: number, w = 100, h = 50) {
  layouts.set(id, {
    id: toNodeId(id),
    position: { x, y },
    size: { width: w, height: h },
    zIndex: 0,
    visible: true,
    bounds: { x, y, width: w, height: h }
  })
}

function graphNode(
  id: string,
  pos: [number, number],
  outputs = 0,
  size: [number, number] = [100, 50]
): LGraphNode {
  return createMockLGraphNode({
    id: toNodeId(id),
    pos,
    size,
    bgcolor: '#fff',
    has_errors: false,
    outputs: Array.from({ length: outputs }, () =>
      fromPartial<INodeOutputSlot>({})
    )
  })
}

describe('MinimapDataSource', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    layouts.clear()
    groupLayouts.clear()
    LiteGraph.vueNodesMode = false
  })

  afterEach(() => {
    LiteGraph.vueNodesMode = false
  })

  describe('source selection', () => {
    it('reads layout geometry in Vue nodes mode', () => {
      LiteGraph.vueNodesMode = true
      registerNodeState('node1')
      setLayout('node1', 10, 20)

      const dataSource = MinimapDataSourceFactory.create(
        createMockGraph([graphNode('node1', [999, 999])])
      )

      expect(dataSource.hasData()).toBe(true)
      expect(dataSource.getNodes()).toMatchObject([{ x: 10, y: 20 }])
    })

    it('reads node geometry under the legacy canvas', () => {
      registerNodeState('node1')
      setLayout('node1', 10, 20)

      const dataSource = MinimapDataSourceFactory.create(
        createMockGraph([graphNode('node1', [999, 888])])
      )

      expect(dataSource.getNodes()).toMatchObject([{ x: 999, y: 888 }])
    })

    it('does not switch source just because layoutStore holds rows', () => {
      // Regression: selecting on store emptiness coupled the minimap to
      // unrelated seeding decisions, changing it in every screenshot.
      setLayout('node1', 10, 20)
      registerNodeState('node1')

      const dataSource = MinimapDataSourceFactory.create(
        createMockGraph([graphNode('node1', [999, 888])])
      )

      expect(dataSource.getNodes()).toMatchObject([{ x: 999, y: 888 }])
    })

    it('handles an empty graph in either mode', () => {
      for (const vueNodesMode of [false, true]) {
        LiteGraph.vueNodesMode = vueNodesMode
        const dataSource = MinimapDataSourceFactory.create(createMockGraph())

        expect(dataSource.hasData()).toBe(false)
        expect(dataSource.getNodeCount()).toBe(0)
        expect(dataSource.getNodes()).toEqual([])
        expect(dataSource.getLinks()).toEqual([])
        expect(dataSource.getGroups()).toEqual([])
      }
    })
  })

  describe('graph scoping', () => {
    it('excludes layout entries belonging to another graph', () => {
      LiteGraph.vueNodesMode = true
      registerNodeState('viewed')
      registerNodeState('interior', 'some-subgraph' as UUID)
      setLayout('viewed', 0, 0)
      setLayout('interior', 5000, 5000)

      const dataSource = MinimapDataSourceFactory.create(
        createMockGraph([graphNode('viewed', [0, 0])])
      )

      expect(dataSource.getNodes().map((n) => n.id)).toEqual([
        toNodeId('viewed')
      ])
      // The far-away interior node must not stretch the minimap's bounds.
      expect(dataSource.getBounds()).toMatchObject({ maxX: 100, maxY: 50 })
    })

    it('skips a viewed node that has no layout entry yet', () => {
      LiteGraph.vueNodesMode = true
      registerNodeState('unseeded')

      const dataSource = MinimapDataSourceFactory.create(
        createMockGraph([graphNode('unseeded', [0, 0])])
      )

      expect(dataSource.getNodes()).toEqual([])
      expect(dataSource.hasData()).toBe(false)
    })
  })

  describe('group geometry', () => {
    /** Deliberately disagrees with the store so the read source is provable. */
    function staleGroup(id: number): LGraphGroup {
      return fromPartial<LGraphGroup>({
        id,
        pos: [-1, -1],
        size: [1, 1],
        color: '#abcdef'
      })
    }

    it('reads group geometry from the store, not the group', () => {
      LiteGraph.vueNodesMode = true
      groupLayouts.set(toGroupId(7), {
        id: toGroupId(7),
        position: { x: 40, y: 60 },
        size: { width: 300, height: 200 }
      })
      const dataSource = MinimapDataSourceFactory.create(
        createMockGraph([graphNode('node1', [0, 0])], [staleGroup(7)])
      )

      expect(dataSource.getGroups()).toEqual([
        { x: 40, y: 60, width: 300, height: 200, color: '#abcdef' }
      ])
      expect(getAllGroups).toHaveBeenCalledWith(GRAPH_ID)
    })

    it('skips groups with no store entry', () => {
      LiteGraph.vueNodesMode = true
      const dataSource = MinimapDataSourceFactory.create(
        createMockGraph([graphNode('node1', [0, 0])], [staleGroup(7)])
      )

      expect(dataSource.getGroups()).toEqual([])
    })

    it('reads group geometry from the graph in legacy mode', () => {
      const dataSource = MinimapDataSourceFactory.create(
        createMockGraph([graphNode('node1', [0, 0])], [staleGroup(7)])
      )

      expect(dataSource.getGroups()).toEqual([
        { x: -1, y: -1, width: 1, height: 1, color: '#abcdef' }
      ])
    })
  })

  describe('Link extraction', () => {
    it('derives links between visible nodes from the link store', () => {
      useLinkStore().registerLink(GRAPH_ID, {
        id: toLinkId(1),
        originNodeId: toNodeId('node1'),
        originSlot: 0,
        targetNodeId: toNodeId('node2'),
        targetSlot: 1,
        type: 'INT'
      })

      const dataSource = MinimapDataSourceFactory.create(
        createMockGraph([
          graphNode('node1', [0, 0], 1),
          graphNode('node2', [0, 0])
        ])
      )

      const links = dataSource.getLinks()
      expect(links).toHaveLength(1)
      expect(links[0]).toMatchObject({ sourceSlot: 0, targetSlot: 1 })
      expect(links[0].sourceNode.id).toBe(toNodeId('node1'))
      expect(links[0].targetNode.id).toBe(toNodeId('node2'))
    })

    it('omits links whose target is not in the viewed nodes', () => {
      useLinkStore().registerLink(GRAPH_ID, {
        id: toLinkId(1),
        originNodeId: toNodeId('node1'),
        originSlot: 0,
        targetNodeId: toNodeId('elsewhere'),
        targetSlot: 0,
        type: 'INT'
      })

      const dataSource = MinimapDataSourceFactory.create(
        createMockGraph([graphNode('node1', [0, 0], 1)])
      )

      expect(dataSource.getLinks()).toEqual([])
    })
  })

  describe('Bounds calculation', () => {
    it('should calculate correct bounds from nodes', () => {
      const dataSource = MinimapDataSourceFactory.create(
        createMockGraph([
          graphNode('node1', [0, 0]),
          graphNode('node2', [200, 100], 0, [150, 75])
        ])
      )

      expect(dataSource.getBounds()).toEqual({
        minX: 0,
        minY: 0,
        maxX: 350,
        maxY: 175,
        width: 350,
        height: 175
      })
    })
  })
})
