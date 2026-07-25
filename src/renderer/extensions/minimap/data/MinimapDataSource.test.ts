import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { INodeOutputSlot } from '@/lib/litegraph/src/interfaces'
import type { LGraph, LGraphNode, LLink } from '@/lib/litegraph/src/litegraph'
import { LGraphEventMode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { NodeLayout } from '@/renderer/core/layout/types'
import { MinimapDataSourceFactory } from '@/renderer/extensions/minimap/data/MinimapDataSourceFactory'
import { useLinkStore } from '@/stores/linkStore'
import { useNodeDataStore } from '@/stores/nodeDataStore'
import { toLinkId } from '@/types/linkId'
import { toNodeId } from '@/types/nodeId'
import type { NodeId } from '@/types/nodeId'
import type { UUID } from '@/utils/uuid'

const layouts = vi.hoisted(() => new Map<string, NodeLayout>())

vi.mock('@/renderer/core/layout/store/layoutStore', () => ({
  layoutStore: {
    getNodeLayoutRef: vi.fn((nodeId: NodeId) => ({
      get value() {
        return layouts.get(String(nodeId)) ?? null
      }
    }))
  }
}))

vi.mock('@/stores/executionStore', () => ({
  useExecutionStore: vi.fn().mockReturnValue({
    nodeProgressStates: {},
    nodeLocationProgressStates: {}
  })
}))

const GRAPH_ID: UUID = 'minimap-graph'

function createMockLinks(): LGraph['links'] {
  return new Map<number, LLink>() as unknown as LGraph['links']
}

function createMockGraph(
  nodes: LGraphNode[] = [],
  id: UUID = GRAPH_ID
): LGraph {
  const byId = new Map(nodes.map((n) => [String(n.id), n]))
  return {
    id,
    _nodes: nodes,
    _groups: [],
    links: createMockLinks(),
    rootGraph: { id: GRAPH_ID },
    getNodeById: (nodeId: NodeId) => byId.get(String(nodeId)) ?? null
  } as unknown as LGraph
}

/** Adds a node to `nodeDataStore`, which is how the layout source scopes. */
function registerNodeState(id: string, graphId: UUID = GRAPH_ID) {
  useNodeDataStore().registerNode(GRAPH_ID, {
    id: toNodeId(id),
    graphId,
    type: 'TestNode',
    title: id,
    mode: LGraphEventMode.ALWAYS,
    flags: {},
    bgcolor: '#123456'
  })
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
  return {
    id: toNodeId(id),
    pos,
    size,
    bgcolor: '#fff',
    mode: LGraphEventMode.ALWAYS,
    has_errors: false,
    outputs: Array.from({ length: outputs }, () => ({}) as INodeOutputSlot)
  } as unknown as LGraphNode
}

describe('MinimapDataSource', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    layouts.clear()
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
